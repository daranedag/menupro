ALTER TABLE public.menupro_subscriptions ADD COLUMN first_month_offer boolean NOT NULL DEFAULT false;

CREATE FUNCTION public.menupro_admin_first_month_offer(p_business_id uuid,p_percent integer,p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_result jsonb;
BEGIN
 v_result:=public.menupro_admin_set_welcome(p_business_id,p_percent,1,p_reason);
 UPDATE public.menupro_subscriptions SET first_month_offer=true WHERE business_id=p_business_id;
 RETURN v_result;
END; $$;
REVOKE ALL ON FUNCTION public.menupro_admin_first_month_offer(uuid,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.menupro_admin_first_month_offer(uuid,integer,text) TO authenticated;

CREATE FUNCTION public.menupro_welcome_available(s public.menupro_subscriptions,p_cycle text) RETURNS boolean
LANGUAGE sql STABLE SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT s.welcome_redeemed_at IS NULL AND (
  (p_cycle='monthly' AND s.first_month_offer AND s.current_period_end IS NULL)
  OR (s.trial_started_at IS NOT NULL AND s.first_menu_saved_at IS NOT NULL AND now()<=s.trial_ends_at+interval '7 days')
 );
$$;
REVOKE ALL ON FUNCTION public.menupro_welcome_available(public.menupro_subscriptions,text) FROM PUBLIC,anon,authenticated;


CREATE OR REPLACE FUNCTION public.menupro_quote_before_launch(p_business_id uuid,p_plan_id text,p_cycle text,p_purpose text DEFAULT 'subscription') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_s public.menupro_subscriptions; v_plan public.menupro_plans; v_old public.menupro_plans; v_net integer; v_regular integer; v_welcome boolean; v_start timestamptz; v_factor numeric:=1; v_fraction numeric; v_party text;
BEGIN
 PERFORM public.menupro_require_owner(p_business_id);
 SELECT * INTO v_s FROM public.menupro_subscriptions WHERE business_id=p_business_id;
 SELECT * INTO v_plan FROM public.menupro_plans WHERE id=p_plan_id;
 IF v_plan.id IS NULL OR p_cycle NOT IN ('monthly','annual') OR p_purpose NOT IN ('subscription','upgrade','prepaid') THEN RAISE EXCEPTION 'Plan inválido.' USING ERRCODE='P0001'; END IF;
 v_regular:=CASE WHEN p_cycle='monthly' THEN v_plan.monthly_net ELSE v_plan.annual_net END;
 v_welcome:=public.menupro_welcome_available(v_s,p_cycle);
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
 IF v_s.first_month_offer AND v_s.current_period_end IS NULL AND EXISTS(
  SELECT 1 FROM public.menupro_checkout_requests WHERE business_id=p_business_id AND status IN ('pending','ready','authorized')
 ) THEN RAISE EXCEPTION 'Cancela la contratación online pendiente antes de registrar esta transferencia.' USING ERRCODE='P0001'; END IF;
 IF EXISTS(SELECT 1 FROM public.menupro_payment_events WHERE provider_payment_id='bank:'||trim(p_reference)) THEN
  RAISE EXCEPTION 'Ese comprobante ya está registrado.' USING ERRCODE='P0001'; END IF;
 IF (SELECT count(*) FROM public.menupro_restaurants WHERE business_id=p_business_id AND archived_at IS NULL)>v_p.max_restaurants AND v_s.pending_restaurant_id IS NULL THEN
  RAISE EXCEPTION 'Selecciona primero qué restaurante permanecerá activo.' USING ERRCODE='P0001'; END IF;
 v_regular:=CASE WHEN p_cycle='annual' THEN v_p.annual_net ELSE v_p.monthly_net END;
 v_welcome:=public.menupro_welcome_available(v_s,p_cycle) OR
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

