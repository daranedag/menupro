-- Monthly welcome terms are scoped to the business and snapshotted at checkout.
-- Existing customers retain the default 20% for three payments; no offer is granted here.
ALTER TABLE public.menupro_subscriptions
 ADD COLUMN monthly_welcome_percent integer NOT NULL DEFAULT 20 CHECK(monthly_welcome_percent BETWEEN 1 AND 95),
 ADD COLUMN monthly_welcome_payments integer NOT NULL DEFAULT 3 CHECK(monthly_welcome_payments BETWEEN 1 AND 3);
ALTER TABLE public.menupro_checkout_requests
 ADD COLUMN monthly_welcome_percent integer NOT NULL DEFAULT 20 CHECK(monthly_welcome_percent BETWEEN 1 AND 95),
 ADD COLUMN monthly_welcome_payments integer NOT NULL DEFAULT 3 CHECK(monthly_welcome_payments BETWEEN 1 AND 3);

CREATE FUNCTION public.menupro_snapshot_welcome_terms() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 SELECT monthly_welcome_percent,monthly_welcome_payments INTO NEW.monthly_welcome_percent,NEW.monthly_welcome_payments
 FROM public.menupro_subscriptions WHERE business_id=NEW.business_id FOR SHARE;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.menupro_snapshot_welcome_terms() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER menupro_checkout_welcome_terms BEFORE INSERT ON public.menupro_checkout_requests
 FOR EACH ROW EXECUTE FUNCTION public.menupro_snapshot_welcome_terms();

CREATE FUNCTION public.menupro_admin_set_welcome(p_business_id uuid,p_percent integer,p_payments integer,p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE s public.menupro_subscriptions; result jsonb;
BEGIN
 IF NOT public.menupro_is_admin() THEN RAISE EXCEPTION 'No tienes permiso.' USING ERRCODE='42501'; END IF;
 IF p_percent IS NULL OR p_percent NOT BETWEEN 1 AND 95 OR p_payments IS NULL OR p_payments NOT BETWEEN 1 AND 3
  OR p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 5 AND 1000 THEN
  RAISE EXCEPTION 'Registra porcentaje, cantidad de cobros y motivo válidos.' USING ERRCODE='P0001'; END IF;
 SELECT * INTO s FROM public.menupro_subscriptions WHERE business_id=p_business_id FOR UPDATE;
 IF s.business_id IS NULL OR s.welcome_redeemed_at IS NOT NULL OR s.welcome_payments_used<>0 OR s.current_period_end IS NOT NULL
  OR s.provider_subscription_id IS NOT NULL OR EXISTS(SELECT 1 FROM public.menupro_checkout_requests WHERE business_id=p_business_id AND status IN ('pending','ready','authorized','paid'))
  OR EXISTS(SELECT 1 FROM public.menupro_payment_events WHERE business_id=p_business_id AND period_end IS NOT NULL) THEN
  RAISE EXCEPTION 'La bienvenida solo puede ajustarse antes de contratar o recibir el primer pago.' USING ERRCODE='P0001'; END IF;
 UPDATE public.menupro_subscriptions SET monthly_welcome_percent=p_percent,monthly_welcome_payments=p_payments,updated_at=now()
  WHERE business_id=p_business_id;
 result:=jsonb_build_object('business_id',p_business_id,'percent',p_percent,'payments',p_payments);
 INSERT INTO public.menupro_audit_events(business_id,actor_id,event,details) VALUES(p_business_id,auth.uid(),'welcome_terms_changed',
  result||jsonb_build_object('reason',trim(p_reason),'previous_percent',s.monthly_welcome_percent,'previous_payments',s.monthly_welcome_payments));
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.menupro_admin_set_welcome(uuid,integer,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.menupro_admin_set_welcome(uuid,integer,integer,text) TO authenticated;


CREATE OR REPLACE FUNCTION public.menupro_quote_before_launch(p_business_id uuid,p_plan_id text,p_cycle text,p_purpose text DEFAULT 'subscription') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_s public.menupro_subscriptions; v_plan public.menupro_plans; v_old public.menupro_plans; v_net integer; v_regular integer; v_welcome boolean; v_start timestamptz; v_factor numeric:=1; v_fraction numeric; v_party text;
BEGIN
 PERFORM public.menupro_require_owner(p_business_id);
 SELECT * INTO v_s FROM public.menupro_subscriptions WHERE business_id=p_business_id;
 SELECT * INTO v_plan FROM public.menupro_plans WHERE id=p_plan_id;
 IF v_plan.id IS NULL OR p_cycle NOT IN ('monthly','annual') OR p_purpose NOT IN ('subscription','upgrade','prepaid') THEN RAISE EXCEPTION 'Plan inválido.' USING ERRCODE='P0001'; END IF;
 v_regular:=CASE WHEN p_cycle='monthly' THEN v_plan.monthly_net ELSE v_plan.annual_net END;
 v_welcome:=v_s.trial_started_at IS NOT NULL AND v_s.first_menu_saved_at IS NOT NULL AND v_s.welcome_redeemed_at IS NULL AND now()<=v_s.trial_ends_at+interval '7 days';
 v_net:=CASE WHEN v_welcome AND p_cycle='monthly' THEN round(v_regular*(100-v_s.monthly_welcome_percent)/100.0) WHEN v_welcome THEN round(v_regular*.9) ELSE v_regular END;
 v_start:=greatest(now(),coalesce(v_s.trial_ends_at,now()),coalesce(v_s.current_period_end,now()));
 IF p_purpose='upgrade' THEN
  SELECT * INTO v_old FROM public.menupro_plans WHERE id=v_s.plan_id;
  IF v_s.current_period_end<=now() OR v_s.current_period_end IS NULL OR v_plan.max_restaurants<=v_old.max_restaurants OR v_s.billing_cycle<>p_cycle THEN RAISE EXCEPTION 'La mejora no está disponible para este período.' USING ERRCODE='P0001'; END IF;
  IF v_s.welcome_redeemed_at IS NOT NULL AND v_s.welcome_cycle=p_cycle AND v_s.welcome_payments_used>=1 AND v_s.welcome_payments_used<=(CASE WHEN p_cycle='monthly' THEN v_s.monthly_welcome_payments ELSE 1 END) THEN
   v_factor:=CASE WHEN p_cycle='monthly' THEN (100-v_s.monthly_welcome_percent)/100.0 ELSE .9 END;
  END IF;
  v_fraction:=least(1,greatest(0,extract(epoch FROM v_s.current_period_end-now())/nullif(extract(epoch FROM v_s.current_period_end-v_s.current_period_start),0)));
  v_net:=greatest(1,round((v_regular-(CASE WHEN p_cycle='monthly' THEN v_old.monthly_net ELSE v_old.annual_net END))*v_factor*v_fraction));
  v_welcome:=false; v_start:=now();
 END IF;
 SELECT withholding_party INTO v_party FROM public.menupro_billing_profiles WHERE business_id=p_business_id;
 RETURN public.menupro_honorarium(v_net,coalesce(v_party,'emitter'),v_start) || jsonb_build_object('plan_id',p_plan_id,'cycle',p_cycle,'purpose',p_purpose,'regular_gross',(public.menupro_honorarium(v_regular,coalesce(v_party,'emitter'),v_start)->>'gross_amount')::integer,'welcome',v_welcome,'starts_at',v_start,
  'discount_percent',CASE WHEN v_welcome AND p_cycle='monthly' THEN v_s.monthly_welcome_percent WHEN v_welcome THEN 10 ELSE 0 END,
  'discount_payments',CASE WHEN v_welcome AND p_cycle='monthly' THEN v_s.monthly_welcome_payments WHEN v_welcome THEN 1 ELSE 0 END);
END;
$$;

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
 IF v_r.welcome AND ((v_r.cycle='monthly' AND v_used<v_r.monthly_welcome_payments) OR (v_r.cycle='annual' AND v_used<1)) THEN
  v_net:=round(v_net*CASE WHEN v_r.cycle='monthly' THEN (100-v_r.monthly_welcome_percent)/100.0 ELSE .9 END);
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

CREATE OR REPLACE FUNCTION public.menupro_admin_prepaid_internal(p_business_id uuid,p_plan_id text,p_cycle text,p_reference text,p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_id uuid; v_start timestamptz; v_end timestamptz; v_s public.menupro_subscriptions; v_p public.menupro_plans; v_net integer; v_regular integer; v_welcome boolean; v_paid integer; v_regular_paid integer; v_party text;
BEGIN
 IF NOT public.menupro_is_admin() THEN RAISE EXCEPTION 'No tienes permiso.' USING ERRCODE='42501'; END IF;
 IF length(trim(p_reference)) NOT BETWEEN 4 AND 200 OR length(trim(p_reason))<5 OR p_cycle NOT IN ('monthly','annual') THEN RAISE EXCEPTION 'Registra el comprobante y motivo del pago.' USING ERRCODE='P0001'; END IF;
 SELECT * INTO v_s FROM public.menupro_subscriptions WHERE business_id=p_business_id FOR UPDATE;
 SELECT * INTO v_p FROM public.menupro_plans WHERE id=p_plan_id;
 IF v_s.business_id IS NULL OR v_p.id IS NULL OR (v_s.provider_subscription_id IS NOT NULL AND NOT v_s.cancel_at_period_end) THEN
  RAISE EXCEPTION 'Confirma primero la cancelación de cualquier renovación automática.' USING ERRCODE='P0001'; END IF;
 IF EXISTS(SELECT 1 FROM public.menupro_payment_events WHERE provider_payment_id='bank:'||trim(p_reference)) THEN
  RAISE EXCEPTION 'Ese comprobante ya está registrado.' USING ERRCODE='P0001'; END IF;
 IF (SELECT count(*) FROM public.menupro_restaurants WHERE business_id=p_business_id AND archived_at IS NULL)>v_p.max_restaurants AND v_s.pending_restaurant_id IS NULL THEN
  RAISE EXCEPTION 'Selecciona primero qué restaurante permanecerá activo.' USING ERRCODE='P0001'; END IF;
 v_regular:=CASE WHEN p_cycle='annual' THEN v_p.annual_net ELSE v_p.monthly_net END;
 v_welcome:=(v_s.welcome_redeemed_at IS NULL AND v_s.trial_started_at IS NOT NULL AND v_s.first_menu_saved_at IS NOT NULL AND now()<=v_s.trial_ends_at+interval '7 days') OR
   (v_s.welcome_redeemed_at IS NOT NULL AND v_s.welcome_cycle=p_cycle AND v_s.welcome_payments_used<CASE WHEN p_cycle='annual' THEN 1 ELSE v_s.monthly_welcome_payments END);
 v_net:=CASE WHEN v_welcome THEN round(v_regular*CASE WHEN p_cycle='annual' THEN .9 ELSE (100-v_s.monthly_welcome_percent)/100.0 END) ELSE v_regular END;
 v_start:=greatest(now(),v_s.trial_ends_at,v_s.current_period_end);
 v_end:=v_start+CASE WHEN p_cycle='annual' THEN interval '1 year' ELSE interval '1 month' END;
 SELECT withholding_party INTO v_party FROM public.menupro_billing_profiles WHERE business_id=p_business_id;
 v_paid:=(public.menupro_honorarium(v_net,v_party,now())->>'gross_amount')::integer;
 v_regular_paid:=(public.menupro_honorarium(v_regular,v_party,now())->>'gross_amount')::integer;
 INSERT INTO public.menupro_checkout_requests(business_id,plan_id,cycle,purpose,net_amount,gross_amount,regular_gross,starts_at,status,created_by,welcome)
 VALUES(p_business_id,p_plan_id,p_cycle,'prepaid',v_net,v_paid,v_regular_paid,v_start,'paid',auth.uid(),v_welcome) RETURNING id INTO v_id;
 INSERT INTO public.menupro_payment_events(provider_payment_id,request_id,business_id,status,amount,currency,period_start,period_end,approved_at,provider_modified_at)
 VALUES('bank:'||trim(p_reference),v_id,p_business_id,'approved',v_paid,'CLP',v_start,v_end,now(),now());
 PERFORM public.menupro_queue_honorarium('bank:'||trim(p_reference),v_net,now());
 UPDATE public.menupro_subscriptions SET plan_id=p_plan_id,status='active',billing_cycle=p_cycle,current_period_start=v_start,current_period_end=v_end,
  grace_until=NULL,cancel_at_period_end=true,pending_plan_id=NULL,pending_restaurant_id=NULL,retention_notice_at=NULL,content_deleted_at=NULL,
  welcome_redeemed_at=CASE WHEN v_welcome THEN coalesce(welcome_redeemed_at,now()) ELSE welcome_redeemed_at END,
  welcome_cycle=CASE WHEN v_welcome THEN coalesce(welcome_cycle,p_cycle) ELSE welcome_cycle END,
  welcome_payments_used=welcome_payments_used+CASE WHEN v_welcome THEN 1 ELSE 0 END,updated_at=now() WHERE business_id=p_business_id;
 IF v_s.pending_restaurant_id IS NOT NULL AND p_plan_id='local' THEN UPDATE public.menupro_restaurants SET archived_at=now() WHERE business_id=p_business_id AND id<>v_s.pending_restaurant_id AND archived_at IS NULL; END IF;
 INSERT INTO public.menupro_audit_events(business_id,actor_id,event,details) VALUES(p_business_id,auth.uid(),'bank_payment_confirmed',jsonb_build_object('reference',p_reference,'reason',p_reason,'period_end',v_end));
 RETURN jsonb_build_object('ends_at',v_end,'gross_amount',v_paid);
END;
$$;

CREATE OR REPLACE FUNCTION public.menupro_worker_outbox(p_secret text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
 PERFORM public.menupro_require_worker(p_secret);
 RETURN jsonb_build_object('notifications',coalesce((SELECT jsonb_agg(jsonb_build_object('id',n.id,'subject',n.subject,'message',n.message,'email',u.email))
  FROM (SELECT * FROM public.menupro_notifications WHERE email_sent_at IS NULL ORDER BY created_at LIMIT 20) n
  JOIN public.menupro_businesses b ON b.id=n.business_id JOIN auth.users u ON u.id=b.owner_id WHERE u.email_verified),'[]'),
  'subscriptions',coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM (SELECT s.business_id,s.provider_subscription_id,s.pending_plan_id,s.welcome_cycle,s.welcome_payments_used,s.welcome_redeemed_at,
   s.billing_cycle,s.current_period_end,s.cancel_at_period_end,p.monthly_net,p.annual_net,r.tax_mode,r.billing_snapshot,r.welcome AS checkout_welcome,r.monthly_welcome_percent,r.monthly_welcome_payments FROM public.menupro_subscriptions s
   LEFT JOIN public.menupro_checkout_requests r ON r.provider_id=s.provider_subscription_id
   JOIN public.menupro_plans p ON p.id=coalesce(s.pending_plan_id,s.plan_id) WHERE s.provider_subscription_id IS NOT NULL AND NOT s.cancel_at_period_end) t),'[]'));
END;
$$;
