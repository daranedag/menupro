-- New contracts use gross honoraria. Preserve the tax treatment of old records.
CREATE FUNCTION public.menupro_valid_rut(p_rut text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v text:=upper(regexp_replace(p_rut,'[.[:space:]-]','','g')); s integer:=0; f integer:=2; i integer; d text;
BEGIN
 IF v IS NULL OR v !~ '^[1-9][0-9]{6,7}[0-9K]$' THEN RETURN false; END IF;
 FOR i IN REVERSE length(v)-1..1 LOOP s:=s+substr(v,i,1)::integer*f; f:=CASE WHEN f=7 THEN 2 ELSE f+1 END; END LOOP;
 d:=CASE 11-s%11 WHEN 11 THEN '0' WHEN 10 THEN 'K' ELSE (11-s%11)::text END;
 RETURN right(v,1)=d;
END; $$;
CREATE FUNCTION public.menupro_honorarium(p_gross integer,p_party text,p_date timestamptz) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE y integer:=extract(year FROM p_date AT TIME ZONE 'America/Santiago'); r numeric; w integer;
BEGIN
 IF p_gross IS NULL OR p_gross<=0 OR p_party IS NULL OR p_party NOT IN ('recipient','emitter') OR y IS NULL OR y<2025 THEN RAISE EXCEPTION 'Honorario inválido.' USING ERRCODE='P0001'; END IF;
 r:=CASE WHEN y>=2028 THEN .17 WHEN y=2027 THEN .16 WHEN y=2026 THEN .1525 ELSE .145 END;
 w:=CASE WHEN p_party='recipient' THEN round(p_gross*r) ELSE 0 END;
 RETURN jsonb_build_object('honorarium_gross',p_gross,'net_amount',p_gross,'tax_amount',0,'retention_rate',r,'withholding_party',p_party,'withholding_amount',w,'gross_amount',p_gross-w);
END; $$;
CREATE TABLE public.menupro_billing_profiles (
 business_id uuid PRIMARY KEY REFERENCES public.menupro_businesses(id) ON DELETE RESTRICT,
 rut text NOT NULL CHECK(public.menupro_valid_rut(rut)),
 legal_name text NOT NULL CHECK(length(trim(legal_name)) BETWEEN 3 AND 200),
 address text NOT NULL CHECK(length(trim(address)) BETWEEN 5 AND 250),
 commune text NOT NULL CHECK(length(trim(commune)) BETWEEN 2 AND 100),
 email text NOT NULL CHECK(length(email) BETWEEN 5 AND 254 AND email LIKE '%@%'),
 withholding_party text NOT NULL CHECK(withholding_party IN ('recipient','emitter')),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.menupro_billing_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.menupro_billing_profiles FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.menupro_billing_profiles TO authenticated;
CREATE POLICY menupro_billing_profiles_read ON public.menupro_billing_profiles FOR SELECT TO authenticated
 USING(public.menupro_business_role(business_id)='owner' OR public.menupro_is_admin());
CREATE FUNCTION public.menupro_save_billing_profile(p_business_id uuid,p_rut text,p_legal_name text,p_address text,p_commune text,p_email text,p_withholding_party text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v public.menupro_billing_profiles;
BEGIN
 PERFORM public.menupro_require_owner(p_business_id);
 PERFORM 1 FROM public.menupro_subscriptions WHERE business_id=p_business_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.menupro_subscriptions WHERE business_id=p_business_id AND provider_subscription_id IS NOT NULL AND NOT cancel_at_period_end)
 OR EXISTS(SELECT 1 FROM public.menupro_checkout_requests WHERE business_id=p_business_id AND status IN ('pending','ready','authorized')) THEN
  RAISE EXCEPTION 'Anula la contratación pendiente o cancela la renovación antes de cambiar los datos tributarios. La contratación nueva usará los datos actualizados.' USING ERRCODE='P0001'; END IF;
 INSERT INTO public.menupro_billing_profiles(business_id,rut,legal_name,address,commune,email,withholding_party)
 VALUES(p_business_id,upper(regexp_replace(p_rut,'[.[:space:]-]','','g')),trim(p_legal_name),trim(p_address),trim(p_commune),lower(trim(p_email)),p_withholding_party)
 ON CONFLICT(business_id) DO UPDATE SET rut=excluded.rut,legal_name=excluded.legal_name,address=excluded.address,commune=excluded.commune,email=excluded.email,withholding_party=excluded.withholding_party,updated_at=now() RETURNING * INTO v;
 INSERT INTO public.menupro_audit_events(business_id,actor_id,event,details) VALUES(p_business_id,auth.uid(),'billing_profile_updated',jsonb_build_object('withholding_party',p_withholding_party));
 RETURN to_jsonb(v);
END; $$;
ALTER TABLE public.menupro_checkout_requests ADD COLUMN tax_mode text NOT NULL DEFAULT 'legacy_vat' CHECK(tax_mode IN ('legacy_vat','honorarios'));
ALTER TABLE public.menupro_checkout_requests ADD COLUMN billing_snapshot jsonb;
CREATE FUNCTION public.menupro_snapshot_billing() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v public.menupro_billing_profiles;
BEGIN
 SELECT * INTO v FROM public.menupro_billing_profiles WHERE business_id=NEW.business_id;
 IF v.business_id IS NULL THEN RAISE EXCEPTION 'Completa y guarda los datos para la boleta antes de contratar.' USING ERRCODE='P0001'; END IF;
 NEW.tax_mode:='honorarios'; NEW.billing_snapshot:=to_jsonb(v)-'updated_at'-'business_id'; RETURN NEW;
END; $$;
CREATE TRIGGER menupro_checkout_billing_snapshot BEFORE INSERT ON public.menupro_checkout_requests FOR EACH ROW EXECUTE FUNCTION public.menupro_snapshot_billing();

CREATE TABLE public.menupro_fiscal_documents (
 payment_id text PRIMARY KEY REFERENCES public.menupro_payment_events(provider_payment_id),
 business_id uuid NOT NULL REFERENCES public.menupro_businesses(id),
 document_type text NOT NULL DEFAULT 'honorarios' CHECK(document_type='honorarios'),
 billing_snapshot jsonb NOT NULL,
 honorarium_gross integer NOT NULL CHECK(honorarium_gross>0),
 withholding_amount integer NOT NULL CHECK(withholding_amount>=0),
 retention_rate numeric NOT NULL,
 paid_amount integer NOT NULL CHECK(paid_amount>0),
 expected_issue_date date NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','issued')),
 folio text UNIQUE CHECK(folio ~ '^[0-9]{1,20}$'), issued_date date,
 review_required boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(honorarium_gross=paid_amount+withholding_amount),
 CHECK((status='pending' AND folio IS NULL AND issued_date IS NULL) OR (status='issued' AND folio IS NOT NULL AND issued_date IS NOT NULL))
);
ALTER TABLE public.menupro_fiscal_documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.menupro_fiscal_documents FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.menupro_fiscal_documents TO authenticated;
CREATE POLICY menupro_fiscal_read ON public.menupro_fiscal_documents FOR SELECT TO authenticated USING(public.menupro_business_role(business_id)='owner' OR public.menupro_is_admin());
CREATE FUNCTION public.menupro_queue_honorarium(p_payment_id text,p_gross integer,p_due_at timestamptz) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE e public.menupro_payment_events; r public.menupro_checkout_requests; a jsonb;
BEGIN
 SELECT * INTO e FROM public.menupro_payment_events WHERE provider_payment_id=p_payment_id;
 SELECT * INTO r FROM public.menupro_checkout_requests WHERE id=e.request_id;
 IF r.tax_mode<>'honorarios' THEN RETURN; END IF;
 a:=public.menupro_honorarium(p_gross,r.billing_snapshot->>'withholding_party',p_due_at);
 IF (a->>'gross_amount')::integer<>e.amount THEN RAISE EXCEPTION 'El cobro y el honorario no coinciden.' USING ERRCODE='P0001'; END IF;
 INSERT INTO public.menupro_fiscal_documents(payment_id,business_id,billing_snapshot,honorarium_gross,withholding_amount,retention_rate,paid_amount,expected_issue_date)
 VALUES(e.provider_payment_id,e.business_id,r.billing_snapshot,p_gross,(a->>'withholding_amount')::integer,(a->>'retention_rate')::numeric,e.amount,(p_due_at AT TIME ZONE 'America/Santiago')::date)
 ON CONFLICT(payment_id) DO NOTHING;
END; $$;
CREATE FUNCTION public.menupro_fiscal_payment_review() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NEW.status IN ('refunded','charged_back') OR NEW.refunded_amount>0 THEN
  UPDATE public.menupro_fiscal_documents SET review_required=true,updated_at=now() WHERE payment_id=NEW.provider_payment_id;
 END IF; RETURN NEW;
END; $$;
CREATE TRIGGER menupro_fiscal_payment_review AFTER UPDATE ON public.menupro_payment_events FOR EACH ROW EXECUTE FUNCTION public.menupro_fiscal_payment_review();
CREATE FUNCTION public.menupro_admin_issue_honorarium(p_payment_id text,p_folio text,p_issued_date date) RETURNS jsonb
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
 INSERT INTO public.menupro_notifications(business_id,event_key,subject,message)
 VALUES(d.business_id,'honorarium-issued:'||d.payment_id,'Boleta de honorarios registrada','Registramos la boleta de honorarios N.º '||d.folio||' por tu pago de MenuPro. Puedes consultar el folio y los importes en Suscripción. La emisión y entrega del documento se realizan manualmente.');
 INSERT INTO public.menupro_audit_events(business_id,actor_id,event,details) VALUES(d.business_id,auth.uid(),'honorarium_issued',jsonb_build_object('payment_id',p_payment_id,'folio',p_folio,'issued_date',p_issued_date));
 RETURN to_jsonb(d);
END; $$;

-- Leases and progress are private. No provider or administrative key in clients.
CREATE TABLE public.menupro_reconciliation_jobs (
 request_id uuid PRIMARY KEY REFERENCES public.menupro_checkout_requests(id),
 state jsonb NOT NULL DEFAULT '{"offset":0,"phase":"scan","pending":[]}',
 token uuid, lease_until timestamptz, next_attempt_at timestamptz NOT NULL DEFAULT now(),
 last_checked_at timestamptz, last_success_at timestamptz, failures integer NOT NULL DEFAULT 0
);
ALTER TABLE public.menupro_reconciliation_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.menupro_reconciliation_jobs FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.menupro_reconciliation_jobs TO authenticated;
CREATE POLICY menupro_reconciliation_admin_read ON public.menupro_reconciliation_jobs FOR SELECT TO authenticated USING(public.menupro_is_admin());
CREATE FUNCTION public.menupro_enqueue_reconciliation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NEW.purpose<>'prepaid' THEN INSERT INTO public.menupro_reconciliation_jobs(request_id) VALUES(NEW.id) ON CONFLICT DO NOTHING; END IF; RETURN NEW;
END; $$;
CREATE TRIGGER menupro_enqueue_reconciliation AFTER INSERT ON public.menupro_checkout_requests FOR EACH ROW EXECUTE FUNCTION public.menupro_enqueue_reconciliation();
INSERT INTO public.menupro_reconciliation_jobs(request_id) SELECT id FROM public.menupro_checkout_requests WHERE purpose<>'prepaid';
CREATE FUNCTION public.menupro_claim_reconciliation(p_secret text,p_token uuid,p_request_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE j public.menupro_reconciliation_jobs; r public.menupro_checkout_requests;
BEGIN
 PERFORM public.menupro_require_worker(p_secret);
 SELECT * INTO j FROM public.menupro_reconciliation_jobs WHERE (lease_until IS NULL OR lease_until<now())
 AND ((p_request_id IS NULL AND next_attempt_at<=now()) OR (request_id=p_request_id AND (last_checked_at IS NULL OR last_checked_at<now()-interval '1 minute')))
 ORDER BY last_checked_at NULLS FIRST,request_id FOR UPDATE SKIP LOCKED LIMIT 1;
 IF j.request_id IS NULL THEN RETURN NULL; END IF;
 UPDATE public.menupro_reconciliation_jobs SET token=p_token,lease_until=now()+interval '5 minutes',last_checked_at=now() WHERE request_id=j.request_id;
 SELECT * INTO r FROM public.menupro_checkout_requests WHERE id=j.request_id;
 RETURN jsonb_build_object('id',r.id,'provider_id',r.provider_id,'purpose',r.purpose,'state',j.state);
END; $$;
CREATE FUNCTION public.menupro_save_reconciliation(p_secret text,p_request_id uuid,p_token uuid,p_state jsonb,p_done boolean,p_failed boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 PERFORM public.menupro_require_worker(p_secret);
 IF p_state->>'phase' NOT IN ('scan','apply') OR jsonb_typeof(p_state->'pending')<>'array' OR jsonb_array_length(p_state->'pending')>2000 OR (p_state->>'offset')::integer<0 THEN RAISE EXCEPTION 'Progreso inválido.'; END IF;
 UPDATE public.menupro_reconciliation_jobs SET
  state=CASE WHEN p_done THEN '{"offset":0,"phase":"scan","pending":[]}'::jsonb ELSE p_state END,
  failures=CASE WHEN p_failed THEN failures+1 WHEN p_done THEN 0 ELSE failures END,
  last_success_at=CASE WHEN p_done AND NOT p_failed THEN now() ELSE last_success_at END,
  next_attempt_at=now()+CASE WHEN p_failed THEN interval '5 minutes' WHEN p_done THEN interval '1 hour' ELSE interval '1 minute' END,
  lease_until=CASE WHEN p_failed OR p_done THEN NULL ELSE lease_until END,
  token=CASE WHEN p_failed OR p_done THEN NULL ELSE token END
 WHERE request_id=p_request_id AND token=p_token AND lease_until>now();
 IF NOT FOUND THEN RAISE EXCEPTION 'La conciliación perdió su reserva.' USING ERRCODE='P0001'; END IF;
END; $$;

REVOKE ALL ON FUNCTION public.menupro_save_billing_profile(uuid,text,text,text,text,text,text),public.menupro_admin_issue_honorarium(text,text,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.menupro_save_billing_profile(uuid,text,text,text,text,text,text),public.menupro_admin_issue_honorarium(text,text,date) TO authenticated;
REVOKE ALL ON FUNCTION public.menupro_queue_honorarium(text,integer,timestamptz),public.menupro_snapshot_billing(),public.menupro_fiscal_payment_review(),public.menupro_enqueue_reconciliation() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.menupro_claim_reconciliation(text,uuid,uuid),public.menupro_save_reconciliation(text,uuid,uuid,jsonb,boolean,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.menupro_claim_reconciliation(text,uuid,uuid),public.menupro_save_reconciliation(text,uuid,uuid,jsonb,boolean,boolean) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.menupro_quote(p_business_id uuid,p_plan_id text,p_cycle text,p_purpose text DEFAULT 'subscription') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_s public.menupro_subscriptions; v_plan public.menupro_plans; v_old public.menupro_plans; v_net integer; v_regular integer; v_welcome boolean; v_start timestamptz; v_factor numeric:=1; v_fraction numeric; v_party text;
BEGIN
 PERFORM public.menupro_require_owner(p_business_id);
 SELECT * INTO v_s FROM public.menupro_subscriptions WHERE business_id=p_business_id;
 SELECT * INTO v_plan FROM public.menupro_plans WHERE id=p_plan_id;
 IF v_plan.id IS NULL OR p_cycle NOT IN ('monthly','annual') OR p_purpose NOT IN ('subscription','upgrade','prepaid') THEN RAISE EXCEPTION 'Plan inválido.' USING ERRCODE='P0001'; END IF;
 v_regular:=CASE WHEN p_cycle='monthly' THEN v_plan.monthly_net ELSE v_plan.annual_net END;
 v_welcome:=v_s.trial_started_at IS NOT NULL AND v_s.first_menu_saved_at IS NOT NULL AND v_s.welcome_redeemed_at IS NULL AND now()<=v_s.trial_ends_at+interval '7 days';
 v_net:=CASE WHEN v_welcome AND p_cycle='monthly' THEN round(v_regular*.8) WHEN v_welcome THEN round(v_regular*.9) ELSE v_regular END;
 v_start:=greatest(now(),coalesce(v_s.trial_ends_at,now()),coalesce(v_s.current_period_end,now()));
 IF p_purpose='upgrade' THEN
  SELECT * INTO v_old FROM public.menupro_plans WHERE id=v_s.plan_id;
  IF v_s.current_period_end<=now() OR v_s.current_period_end IS NULL OR v_plan.max_restaurants<=v_old.max_restaurants OR v_s.billing_cycle<>p_cycle THEN RAISE EXCEPTION 'La mejora no está disponible para este período.' USING ERRCODE='P0001'; END IF;
  IF v_s.welcome_redeemed_at IS NOT NULL AND v_s.welcome_cycle=p_cycle AND v_s.welcome_payments_used>=1 AND v_s.welcome_payments_used<=(CASE WHEN p_cycle='monthly' THEN 3 ELSE 1 END) THEN
   v_factor:=CASE WHEN p_cycle='monthly' THEN .8 ELSE .9 END;
  END IF;
  v_fraction:=least(1,greatest(0,extract(epoch FROM v_s.current_period_end-now())/nullif(extract(epoch FROM v_s.current_period_end-v_s.current_period_start),0)));
  v_net:=greatest(1,round((v_regular-(CASE WHEN p_cycle='monthly' THEN v_old.monthly_net ELSE v_old.annual_net END))*v_factor*v_fraction));
  v_welcome:=false; v_start:=now();
 END IF;
 SELECT withholding_party INTO v_party FROM public.menupro_billing_profiles WHERE business_id=p_business_id;
 RETURN public.menupro_honorarium(v_net,coalesce(v_party,'emitter'),v_start) || jsonb_build_object('plan_id',p_plan_id,'cycle',p_cycle,'purpose',p_purpose,'regular_gross',(public.menupro_honorarium(v_regular,coalesce(v_party,'emitter'),v_start)->>'gross_amount')::integer,'welcome',v_welcome,'starts_at',v_start,
  'discount_payments',CASE WHEN v_welcome AND p_cycle='monthly' THEN 3 WHEN v_welcome THEN 1 ELSE 0 END);
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
 ON CONFLICT(provider_payment_id) DO UPDATE SET status=EXCLUDED.status,provider_modified_at=EXCLUDED.provider_modified_at,refunded_amount=EXCLUDED.refunded_amount;
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
   (v_s.welcome_redeemed_at IS NOT NULL AND v_s.welcome_cycle=p_cycle AND v_s.welcome_payments_used<CASE WHEN p_cycle='annual' THEN 1 ELSE 3 END);
 v_net:=CASE WHEN v_welcome THEN round(v_regular*CASE WHEN p_cycle='annual' THEN .9 ELSE .8 END) ELSE v_regular END;
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
   s.billing_cycle,s.current_period_end,s.cancel_at_period_end,p.monthly_net,p.annual_net,r.tax_mode,r.billing_snapshot FROM public.menupro_subscriptions s
   LEFT JOIN public.menupro_checkout_requests r ON r.provider_id=s.provider_subscription_id
   JOIN public.menupro_plans p ON p.id=coalesce(s.pending_plan_id,s.plan_id) WHERE s.provider_subscription_id IS NOT NULL AND NOT s.cancel_at_period_end) t),'[]'));
END;
$$;

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
  UPDATE public.menupro_checkout_requests SET status='cancelled' WHERE id=v_r.id;
  UPDATE public.menupro_subscriptions SET provider_status=p_status,cancel_at_period_end=true,updated_at=now()
   WHERE business_id=v_r.business_id AND provider_subscription_id=p_provider_id;
 END IF;
END;
$$;
