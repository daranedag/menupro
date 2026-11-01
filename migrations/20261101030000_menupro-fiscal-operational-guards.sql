ALTER TABLE public.menupro_billing_profiles DROP CONSTRAINT menupro_billing_profiles_business_id_fkey;
ALTER TABLE public.menupro_billing_profiles ADD CONSTRAINT menupro_billing_profiles_business_id_fkey FOREIGN KEY(business_id) REFERENCES public.menupro_businesses(id) ON DELETE CASCADE;
ALTER TABLE public.menupro_notifications ADD COLUMN recipient_email text;
CREATE OR REPLACE FUNCTION public.menupro_queue_honorarium(p_payment_id text,p_gross integer,p_due_at timestamptz) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE e public.menupro_payment_events; r public.menupro_checkout_requests; a jsonb;
BEGIN
 SELECT * INTO e FROM public.menupro_payment_events WHERE provider_payment_id=p_payment_id;
 SELECT * INTO r FROM public.menupro_checkout_requests WHERE id=e.request_id;
 IF r.tax_mode<>'honorarios' THEN RETURN; END IF;
 a:=public.menupro_honorarium(p_gross,r.billing_snapshot->>'withholding_party',p_due_at);
 IF (a->>'gross_amount')::integer<>e.amount THEN RAISE EXCEPTION 'El cobro y el honorario no coinciden.' USING ERRCODE='P0001'; END IF;
 INSERT INTO public.menupro_fiscal_documents(payment_id,business_id,billing_snapshot,honorarium_gross,withholding_amount,retention_rate,paid_amount,expected_issue_date,review_required)
 VALUES(e.provider_payment_id,e.business_id,r.billing_snapshot,p_gross,(a->>'withholding_amount')::integer,(a->>'retention_rate')::numeric,e.amount,(e.approved_at AT TIME ZONE 'America/Santiago')::date,
 e.refunded_amount>0 OR (r.billing_snapshot->>'withholding_party'='recipient' AND (public.menupro_honorarium(p_gross,'recipient',e.approved_at)->>'retention_rate')::numeric<>(a->>'retention_rate')::numeric))
 ON CONFLICT(payment_id) DO NOTHING;
END; $$;
CREATE OR REPLACE FUNCTION public.menupro_provider_status(p_secret text,p_request_id uuid,p_provider_id text,p_status text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_r public.menupro_checkout_requests;
BEGIN
 PERFORM public.menupro_require_worker(p_secret);
 SELECT * INTO v_r FROM public.menupro_checkout_requests WHERE id=p_request_id AND provider_id=p_provider_id FOR UPDATE;
 IF v_r.id IS NULL OR v_r.purpose<>'subscription' THEN RAISE EXCEPTION 'Suscripción no reconocida.' USING ERRCODE='P0001'; END IF;
 IF p_status='authorized' AND v_r.status NOT IN ('cancelled','failed') THEN
  UPDATE public.menupro_checkout_requests SET status='authorized' WHERE id=v_r.id AND status IN ('pending','ready');
  -- Authorization alone never grants paid access or consumes the discount.
  UPDATE public.menupro_subscriptions SET provider_subscription_id=p_provider_id,provider_status=p_status,updated_at=now() WHERE business_id=v_r.business_id AND (provider_subscription_id IS NULL OR provider_subscription_id=p_provider_id OR cancel_at_period_end)
   AND NOT EXISTS(SELECT 1 FROM public.menupro_checkout_requests newer WHERE newer.business_id=v_r.business_id AND newer.created_at>v_r.created_at AND newer.provider_id IS NOT NULL AND newer.status IN ('authorized','paid'));
 ELSIF p_status IN ('cancelled','canceled','paused') THEN
  UPDATE public.menupro_checkout_requests SET status='cancelled' WHERE id=v_r.id AND status IN ('pending','ready','authorized');
  UPDATE public.menupro_subscriptions SET provider_status=p_status,cancel_at_period_end=true,updated_at=now()
   WHERE business_id=v_r.business_id AND provider_subscription_id=p_provider_id;
 END IF;
END;
$$;
CREATE OR REPLACE FUNCTION public.menupro_admin_issue_honorarium(p_payment_id text,p_folio text,p_issued_date date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE d public.menupro_fiscal_documents;
BEGIN
 IF NOT public.menupro_is_admin() THEN RAISE EXCEPTION 'No tienes permiso.' USING ERRCODE='42501'; END IF;
 SELECT * INTO d FROM public.menupro_fiscal_documents WHERE payment_id=p_payment_id FOR UPDATE;
 IF d.payment_id IS NULL THEN RAISE EXCEPTION 'Documento no encontrado.' USING ERRCODE='P0001'; END IF;
 IF d.status='issued' THEN
  IF d.folio=p_folio AND d.issued_date=p_issued_date THEN RETURN to_jsonb(d); END IF;
  RAISE EXCEPTION 'La boleta ya fue registrada. Una corrección requiere revisión administrativa.' USING ERRCODE='P0001'; END IF;
 IF d.review_required OR p_folio IS NULL OR p_folio !~ '^[0-9]{1,20}$' OR p_issued_date IS NULL OR p_issued_date>current_date OR extract(year FROM p_issued_date)<>extract(year FROM d.expected_issue_date) THEN
  RAISE EXCEPTION 'Revisa el pago, el folio y el año tributario antes de registrar la boleta.' USING ERRCODE='P0001'; END IF;
 UPDATE public.menupro_fiscal_documents SET status='issued',folio=p_folio,issued_date=p_issued_date,updated_at=now() WHERE payment_id=p_payment_id RETURNING * INTO d;
 INSERT INTO public.menupro_notifications(business_id,event_key,subject,message,recipient_email)
 VALUES(d.business_id,'honorarium-issued:'||d.payment_id,'Boleta de honorarios registrada','Registramos la boleta de honorarios N.º '||d.folio||' por tu pago de MenuPro. Puedes consultar el folio y los importes en Suscripción. La emisión y entrega del documento se realizan manualmente.',d.billing_snapshot->>'email');
 INSERT INTO public.menupro_audit_events(business_id,actor_id,event,details) VALUES(d.business_id,auth.uid(),'honorarium_issued',jsonb_build_object('payment_id',p_payment_id,'folio',p_folio,'issued_date',p_issued_date));
 RETURN to_jsonb(d);
END; $$;
CREATE OR REPLACE FUNCTION public.menupro_apply_payment(p_secret text,p_request_id uuid,p_payment_id text,p_invoice_id text,p_status text,
 p_amount integer,p_currency text,p_approved_at timestamptz,p_modified_at timestamptz,p_due_at timestamptz,p_refunded integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_r public.menupro_checkout_requests; v_s public.menupro_subscriptions; v_e public.menupro_payment_events;
 v_start timestamptz; v_end timestamptz; v_expected integer; v_net integer; v_plan public.menupro_plans; v_target text; v_used integer;
BEGIN
 PERFORM public.menupro_require_worker(p_secret);
 SELECT * INTO v_r FROM public.menupro_checkout_requests WHERE id=p_request_id FOR UPDATE;
 IF v_r.id IS NULL THEN RAISE EXCEPTION 'Pago no reconocido.' USING ERRCODE='P0001'; END IF;
 SELECT * INTO v_s FROM public.menupro_subscriptions WHERE business_id=v_r.business_id FOR UPDATE;
 SELECT * INTO v_e FROM public.menupro_payment_events WHERE provider_payment_id=p_payment_id FOR UPDATE;
 IF v_e.provider_payment_id IS NOT NULL AND (v_e.request_id<>p_request_id OR v_e.provider_modified_at>p_modified_at) THEN RETURN jsonb_build_object('ignored',true); END IF;
 IF p_currency<>'CLP' OR p_amount<=0 OR p_refunded<0 OR p_refunded>p_amount THEN RAISE EXCEPTION 'Importe o moneda inválidos.' USING ERRCODE='P0001'; END IF;
 IF nullif(p_invoice_id,'') IS NOT NULL AND EXISTS(SELECT 1 FROM public.menupro_payment_events WHERE provider_invoice_id=p_invoice_id AND period_end IS NOT NULL AND provider_payment_id<>p_payment_id) THEN RETURN jsonb_build_object('ignored',true); END IF;
 IF v_e.period_end IS NOT NULL AND v_e.amount<>p_amount THEN RAISE EXCEPTION 'El importe de un pago confirmado no puede cambiar.' USING ERRCODE='P0001'; END IF;
 v_target:=CASE WHEN v_r.purpose='upgrade' THEN v_r.plan_id ELSE coalesce(v_s.pending_plan_id,CASE WHEN v_r.status<>'paid' THEN v_r.plan_id ELSE v_s.plan_id END) END;
 SELECT * INTO v_plan FROM public.menupro_plans WHERE id=v_target;
 v_used:=v_s.welcome_payments_used;
 v_net:=CASE WHEN v_r.cycle='monthly' THEN v_plan.monthly_net ELSE v_plan.annual_net END;
 IF v_r.welcome AND ((v_r.cycle='monthly' AND v_used<3) OR (v_r.cycle='annual' AND v_used<1)) THEN
  v_net:=round(v_net*CASE WHEN v_r.cycle='monthly' THEN .8 ELSE .9 END);
 END IF;
 v_expected:=CASE WHEN v_r.purpose='upgrade' THEN v_r.gross_amount ELSE CASE WHEN v_r.tax_mode='honorarios' THEN (public.menupro_honorarium(v_net,v_r.billing_snapshot->>'withholding_party',p_due_at)->>'gross_amount')::integer ELSE v_net+round(v_net*.19) END END;
 -- Existing credited payments retain their original amount across plan changes.
 IF v_e.period_end IS NULL AND p_status='approved' AND p_amount<>v_expected THEN RAISE EXCEPTION 'El importe confirmado no coincide con el plan contratado.' USING ERRCODE='P0001'; END IF;
 INSERT INTO public.menupro_payment_events(provider_payment_id,provider_invoice_id,request_id,business_id,status,amount,currency,approved_at,provider_modified_at,refunded_amount)
 VALUES(p_payment_id,nullif(p_invoice_id,''),p_request_id,v_r.business_id,p_status,p_amount,p_currency,p_approved_at,p_modified_at,p_refunded)
 ON CONFLICT(provider_payment_id) DO UPDATE SET status=EXCLUDED.status,approved_at=coalesce(menupro_payment_events.approved_at,EXCLUDED.approved_at),provider_modified_at=EXCLUDED.provider_modified_at,refunded_amount=EXCLUDED.refunded_amount;
 IF p_status='approved' AND v_e.period_end IS NULL THEN
  IF p_approved_at IS NULL THEN RAISE EXCEPTION 'Falta la confirmación de aprobación.' USING ERRCODE='P0001'; END IF;
  IF nullif(p_invoice_id,'') IS NOT NULL AND EXISTS(SELECT 1 FROM public.menupro_payment_events WHERE provider_invoice_id=p_invoice_id AND period_end IS NOT NULL AND provider_payment_id<>p_payment_id) THEN
    RETURN jsonb_build_object('ignored',true); END IF;
  IF v_r.purpose='upgrade' THEN
   v_start:=now(); v_end:=v_s.current_period_end;
   IF v_end IS NULL OR v_end<=now() THEN RAISE EXCEPTION 'El período de la mejora venció.' USING ERRCODE='P0001'; END IF;
   UPDATE public.menupro_subscriptions SET plan_id=v_r.plan_id,updated_at=now() WHERE business_id=v_r.business_id;
  ELSE
   v_start:=CASE WHEN v_s.current_period_end IS NULL THEN greatest(v_r.starts_at,p_approved_at)
    WHEN NOT v_s.cancel_at_period_end AND p_approved_at<=v_s.current_period_end+interval '7 days' THEN v_s.current_period_end
    ELSE greatest(v_s.current_period_end,p_approved_at) END;
   v_end:=v_start+CASE WHEN v_r.cycle='annual' THEN interval '1 year' ELSE interval '1 month' END;
   UPDATE public.menupro_subscriptions SET plan_id=v_target,status='active',billing_cycle=v_r.cycle,current_period_start=v_start,
    current_period_end=v_end,grace_until=NULL,cancel_at_period_end=CASE WHEN v_r.purpose='prepaid' THEN true ELSE false END,
    welcome_redeemed_at=CASE WHEN v_r.welcome THEN coalesce(welcome_redeemed_at,now()) ELSE welcome_redeemed_at END,
    welcome_cycle=CASE WHEN v_r.welcome THEN coalesce(welcome_cycle,v_r.cycle) ELSE welcome_cycle END,
    welcome_payments_used=welcome_payments_used+CASE WHEN v_r.welcome THEN 1 ELSE 0 END,
    pending_plan_id=NULL,pending_restaurant_id=NULL,retention_notice_at=NULL,updated_at=now() WHERE business_id=v_r.business_id;
   IF v_s.pending_plan_id IS NOT NULL THEN
    UPDATE public.menupro_restaurants SET archived_at=now() WHERE business_id=v_r.business_id AND id<>v_s.pending_restaurant_id AND archived_at IS NULL;
   END IF;
  END IF;
  UPDATE public.menupro_payment_events SET period_start=v_start,period_end=v_end,period_plan_id=v_target WHERE provider_payment_id=p_payment_id;
  UPDATE public.menupro_checkout_requests SET status='paid' WHERE id=v_r.id;
  PERFORM public.menupro_queue_honorarium(p_payment_id,CASE WHEN v_r.purpose='upgrade' THEN v_r.net_amount ELSE v_net END,p_due_at);
  INSERT INTO public.menupro_audit_events(business_id,event,details) VALUES(v_r.business_id,'payment_approved',jsonb_build_object('payment_id',p_payment_id,'amount',p_amount,'period_end',v_end));
 ELSIF p_status IN ('refunded','charged_back') OR (p_refunded=p_amount AND p_refunded>0) THEN
  IF v_e.period_end IS NOT NULL AND v_s.current_period_end=v_e.period_end THEN
   IF v_r.purpose='upgrade' THEN
    UPDATE public.menupro_subscriptions SET plan_id='local',updated_at=now() WHERE business_id=v_r.business_id;
    UPDATE public.menupro_restaurants SET archived_at=now() WHERE business_id=v_r.business_id AND archived_at IS NULL AND id<>(SELECT id FROM public.menupro_restaurants WHERE business_id=v_r.business_id AND archived_at IS NULL ORDER BY created_at,id LIMIT 1);
   ELSE
    UPDATE public.menupro_subscriptions SET status='suspended',current_period_end=least(current_period_end,now()),grace_until=NULL,updated_at=now() WHERE business_id=v_r.business_id;
   END IF;
  END IF;
  INSERT INTO public.menupro_audit_events(business_id,event,details) SELECT v_r.business_id,'payment_'||p_status,jsonb_build_object('payment_id',p_payment_id,'refunded',p_refunded)
   WHERE v_e.status IS DISTINCT FROM p_status OR v_e.refunded_amount IS DISTINCT FROM p_refunded;
 ELSIF p_status='approved' AND v_e.status='charged_back' AND v_e.period_end>now() THEN
  IF v_r.purpose='upgrade' THEN
   UPDATE public.menupro_subscriptions SET plan_id=coalesce(v_e.period_plan_id,v_r.plan_id),updated_at=now()
    WHERE business_id=v_r.business_id AND current_period_end=v_e.period_end AND status='active';
  ELSE
   UPDATE public.menupro_subscriptions SET status='active',current_period_end=v_e.period_end,updated_at=now()
    WHERE business_id=v_r.business_id AND status='suspended' AND plan_id=coalesce(v_e.period_plan_id,v_r.plan_id) AND current_period_end<=v_e.period_end;
  END IF;
  INSERT INTO public.menupro_audit_events(business_id,event,details) VALUES(v_r.business_id,'payment_restored',jsonb_build_object('payment_id',p_payment_id,'period_end',v_e.period_end));
 ELSIF p_refunded>0 AND p_refunded<p_amount AND v_e.refunded_amount IS DISTINCT FROM p_refunded THEN
  INSERT INTO public.menupro_audit_events(business_id,event,details) VALUES(v_r.business_id,'partial_refund_review',jsonb_build_object('payment_id',p_payment_id,'refunded',p_refunded,'reason','Requiere especificar el servicio o período conservado.'));
 ELSIF p_status IN ('rejected','cancelled') AND v_s.current_period_end IS NOT NULL AND NOT v_s.cancel_at_period_end
  AND p_due_at>=v_s.current_period_start AND p_due_at<=v_s.current_period_end+interval '1 day' THEN
  UPDATE public.menupro_subscriptions SET status='past_due',grace_until=coalesce(grace_until,current_period_end+interval '7 days'),updated_at=now() WHERE business_id=v_r.business_id;
 END IF;
 RETURN jsonb_build_object('business_id',v_r.business_id,'status',p_status,'credited',v_end IS NOT NULL);
END;
$$;
CREATE OR REPLACE FUNCTION public.menupro_claim_notifications(p_secret text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_result jsonb;
BEGIN
 PERFORM public.menupro_require_worker(p_secret);
 WITH candidates AS (SELECT n.id FROM public.menupro_notifications n JOIN public.menupro_businesses b ON b.id=n.business_id
   JOIN auth.users u ON u.id=b.owner_id WHERE n.email_sent_at IS NULL AND (n.delivery_lease_until IS NULL OR n.delivery_lease_until<now()) AND u.email_verified
   ORDER BY n.created_at LIMIT 20 FOR UPDATE OF n SKIP LOCKED), claimed AS (
  UPDATE public.menupro_notifications n SET delivery_token=gen_random_uuid(),delivery_lease_until=now()+interval '10 minutes'
   FROM candidates c WHERE n.id=c.id RETURNING n.*)
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',n.id,'token',n.delivery_token,'subject',n.subject,'message',n.message,'email',coalesce(n.recipient_email,u.email))),'[]') INTO v_result
  FROM claimed n JOIN public.menupro_businesses b ON b.id=n.business_id JOIN auth.users u ON u.id=b.owner_id;
 RETURN v_result;
END;
$$;
