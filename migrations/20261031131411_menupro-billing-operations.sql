CREATE TABLE public.menupro_system_keys (name text PRIMARY KEY,secret_hash text NOT NULL);
ALTER TABLE public.menupro_system_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.menupro_system_keys FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.menupro_require_worker(p_secret text) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
 IF p_secret IS NULL OR length(p_secret)<40 OR NOT EXISTS(SELECT 1 FROM public.menupro_system_keys
   WHERE name='worker' AND secret_hash=encode(sha256(convert_to(p_secret,'UTF8')),'hex')) THEN
   RAISE EXCEPTION 'Credencial de servicio inválida.' USING ERRCODE='42501'; END IF;
END;
$$;
CREATE TABLE public.menupro_rate_limits (
 key text NOT NULL, action text NOT NULL, window_start timestamptz NOT NULL, count integer NOT NULL DEFAULT 1,
 PRIMARY KEY(key,action,window_start)
);
ALTER TABLE public.menupro_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.menupro_rate_limits FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.menupro_rate_limit(p_secret text,p_key text,p_action text,p_limit integer) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_count integer;
BEGIN
 PERFORM public.menupro_require_worker(p_secret);
 INSERT INTO public.menupro_rate_limits(key,action,window_start) VALUES(left(p_key,128),left(p_action,40),date_trunc('hour',now()))
 ON CONFLICT(key,action,window_start) DO UPDATE SET count=public.menupro_rate_limits.count+1 RETURNING count INTO v_count;
 RETURN v_count<=least(greatest(p_limit,1),100);
END;
$$;

CREATE FUNCTION public.menupro_rename_business(p_business_id uuid,p_name text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
 PERFORM public.menupro_require_owner(p_business_id);
 UPDATE public.menupro_businesses SET name=trim(p_name) WHERE id=p_business_id;
END;
$$;
CREATE FUNCTION public.menupro_revoke_invitation(p_business_id uuid,p_invitation_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
 PERFORM public.menupro_require_owner(p_business_id);
 UPDATE public.menupro_invitations SET revoked_at=now() WHERE id=p_invitation_id AND business_id=p_business_id AND accepted_at IS NULL;
END;
$$;
CREATE FUNCTION public.menupro_read_notification(p_notification_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
 UPDATE public.menupro_notifications SET read_at=now() WHERE id=p_notification_id AND public.menupro_business_role(business_id) IS NOT NULL;
END;
$$;

CREATE FUNCTION public.menupro_admin_overview() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
 IF NOT public.menupro_is_admin() THEN RAISE EXCEPTION 'No tienes permiso.' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object(
 'businesses',coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM (SELECT b.id,b.name,u.email AS owner_email,s.plan_id,s.status,
  s.trial_ends_at,s.current_period_end,s.courtesy_until,s.provider_status,public.menupro_has_access(b.id) AS has_access
  FROM public.menupro_businesses b LEFT JOIN auth.users u ON u.id=b.owner_id
  JOIN public.menupro_subscriptions s ON s.business_id=b.id ORDER BY b.created_at DESC LIMIT 200) t),'[]'),
 'claims',coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM (SELECT c.id,c.business_id,b.name,c.created_at,c.status
  FROM public.menupro_trial_claims c LEFT JOIN public.menupro_businesses b ON b.id=c.business_id WHERE c.status='review' ORDER BY c.created_at LIMIT 100) t),'[]'),
 'events',coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM (SELECT id,business_id,event,details,created_at FROM public.menupro_audit_events ORDER BY created_at DESC LIMIT 100) t),'[]'));
END;
$$;
CREATE FUNCTION public.menupro_admin_review(p_claim_id uuid,p_approve boolean,p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_c public.menupro_trial_claims;
BEGIN
 IF NOT public.menupro_is_admin() THEN RAISE EXCEPTION 'No tienes permiso.' USING ERRCODE='42501'; END IF;
 IF length(trim(p_reason))<5 THEN RAISE EXCEPTION 'Registra el motivo de la decisión.' USING ERRCODE='P0001'; END IF;
 SELECT * INTO v_c FROM public.menupro_trial_claims WHERE id=p_claim_id AND status='review' FOR UPDATE;
 IF v_c.id IS NULL OR v_c.business_id IS NULL THEN RAISE EXCEPTION 'Solicitud no disponible.' USING ERRCODE='P0001'; END IF;
 UPDATE public.menupro_trial_claims SET status=CASE WHEN p_approve THEN 'granted' ELSE 'denied' END,
   reviewed_at=now(),reviewed_by=auth.uid(),reason=p_reason WHERE id=p_claim_id;
 IF p_approve THEN
  UPDATE public.menupro_subscriptions SET status='trial',trial_started_at=now(),trial_ends_at=now()+interval '15 days',updated_at=now()
   WHERE business_id=v_c.business_id AND trial_started_at IS NULL AND status='review';
  IF NOT FOUND THEN RAISE EXCEPTION 'La demo ya fue activada.' USING ERRCODE='P0001'; END IF;
 END IF;
 INSERT INTO public.menupro_audit_events(business_id,actor_id,event,details) VALUES(v_c.business_id,auth.uid(),'trial_reviewed',jsonb_build_object('approved',p_approve,'reason',p_reason));
 INSERT INTO public.menupro_notifications(business_id,event_key,subject,message) VALUES(v_c.business_id,'trial_review_'||p_claim_id,
  CASE WHEN p_approve THEN 'Tu demo está activa' ELSE 'Revisión de tu solicitud' END,
  CASE WHEN p_approve THEN 'Tienes 15 días para probar MenuPro sin tarjeta.' ELSE 'No fue posible conceder otra demo. Contacta a soporte para recuperar el acceso o contratar.' END);
END;
$$;
CREATE FUNCTION public.menupro_admin_courtesy(p_business_id uuid,p_plan_id text,p_days integer,p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
 IF NOT public.menupro_is_admin() THEN RAISE EXCEPTION 'No tienes permiso.' USING ERRCODE='42501'; END IF;
 IF p_days NOT BETWEEN 1 AND 366 OR length(trim(p_reason))<5 OR p_plan_id NOT IN ('local','grupo') THEN RAISE EXCEPTION 'Cortesía inválida.' USING ERRCODE='P0001'; END IF;
 UPDATE public.menupro_subscriptions SET plan_id=p_plan_id,courtesy_until=greatest(now(),coalesce(courtesy_until,now()))+make_interval(days=>p_days),updated_at=now() WHERE business_id=p_business_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Negocio no encontrado.' USING ERRCODE='P0001'; END IF;
 INSERT INTO public.menupro_audit_events(business_id,actor_id,event,details) VALUES(p_business_id,auth.uid(),'courtesy_granted',jsonb_build_object('days',p_days,'plan',p_plan_id,'reason',p_reason));
END;
$$;
CREATE FUNCTION public.menupro_admin_prepare(p_name text,p_email text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_id uuid; v_invitation uuid;
BEGIN
 IF NOT public.menupro_is_admin() THEN RAISE EXCEPTION 'No tienes permiso.' USING ERRCODE='42501'; END IF;
 IF length(trim(p_name)) NOT BETWEEN 1 AND 255 OR length(p_email)>254 OR p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Datos inválidos.' USING ERRCODE='P0001'; END IF;
 INSERT INTO public.menupro_businesses(name,created_by) VALUES(trim(p_name),auth.uid()) RETURNING id INTO v_id;
 INSERT INTO public.menupro_subscriptions(business_id) VALUES(v_id);
 INSERT INTO public.menupro_invitations(business_id,email,role,invited_by) VALUES(v_id,lower(trim(p_email)),'owner',auth.uid()) RETURNING id INTO v_invitation;
 INSERT INTO public.menupro_audit_events(business_id,actor_id,event) VALUES(v_id,auth.uid(),'business_prepared');
 RETURN jsonb_build_object('businessId',v_id,'invitationId',v_invitation);
END;
$$;

CREATE TABLE public.menupro_checkout_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.menupro_businesses(id) ON DELETE RESTRICT,
 plan_id text NOT NULL REFERENCES public.menupro_plans(id),
 cycle text NOT NULL CHECK(cycle IN ('monthly','annual')),
 purpose text NOT NULL DEFAULT 'subscription' CHECK(purpose IN ('subscription','upgrade','prepaid')),
 net_amount integer NOT NULL CHECK(net_amount>0),
 gross_amount integer NOT NULL CHECK(gross_amount>0),
 regular_gross integer NOT NULL CHECK(regular_gross>0),
 welcome boolean NOT NULL DEFAULT false,
 starts_at timestamptz NOT NULL,
 provider_id text UNIQUE,
 checkout_url text,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','ready','authorized','paid','failed','cancelled')),
 created_at timestamptz NOT NULL DEFAULT now(),
 created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX menupro_checkout_requests_business_idx ON public.menupro_checkout_requests(business_id,created_at);
ALTER TABLE public.menupro_checkout_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.menupro_checkout_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.menupro_checkout_requests TO authenticated;
CREATE POLICY menupro_checkouts_read ON public.menupro_checkout_requests FOR SELECT TO authenticated USING(public.menupro_business_role(business_id)='owner' OR public.menupro_is_admin());
CREATE TABLE public.menupro_payment_events (
 provider_payment_id text PRIMARY KEY,
 provider_invoice_id text,
 request_id uuid NOT NULL REFERENCES public.menupro_checkout_requests(id),
 business_id uuid NOT NULL REFERENCES public.menupro_businesses(id) ON DELETE RESTRICT,
 status text NOT NULL,
 amount integer NOT NULL,
 refunded_amount integer NOT NULL DEFAULT 0,
 currency text NOT NULL,
 period_start timestamptz,
 period_end timestamptz,
 approved_at timestamptz,
 provider_modified_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX menupro_payment_events_business_idx ON public.menupro_payment_events(business_id,created_at);
CREATE UNIQUE INDEX menupro_payment_invoice_approved_idx ON public.menupro_payment_events(provider_invoice_id) WHERE provider_invoice_id IS NOT NULL AND period_end IS NOT NULL;
ALTER TABLE public.menupro_payment_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.menupro_payment_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.menupro_payment_events TO authenticated;
CREATE POLICY menupro_payments_read ON public.menupro_payment_events FOR SELECT TO authenticated USING(public.menupro_business_role(business_id)='owner' OR public.menupro_is_admin());

CREATE FUNCTION public.menupro_quote(p_business_id uuid,p_plan_id text,p_cycle text,p_purpose text DEFAULT 'subscription') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_s public.menupro_subscriptions; v_plan public.menupro_plans; v_old public.menupro_plans; v_net integer; v_regular integer; v_welcome boolean; v_start timestamptz;
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
  v_net:=greatest(1,round((v_regular-CASE WHEN p_cycle='monthly' THEN v_old.monthly_net ELSE v_old.annual_net END)
    *extract(epoch FROM v_s.current_period_end-now())/extract(epoch FROM v_s.current_period_end-v_s.current_period_start)));
  v_welcome:=false; v_start:=now();
 END IF;
 RETURN jsonb_build_object('plan_id',p_plan_id,'cycle',p_cycle,'purpose',p_purpose,'net_amount',v_net,'tax_amount',round(v_net*.19),
  'gross_amount',v_net+round(v_net*.19),'regular_gross',v_regular+round(v_regular*.19),'welcome',v_welcome,'starts_at',v_start,
  'discount_payments',CASE WHEN v_welcome AND p_cycle='monthly' THEN 3 WHEN v_welcome THEN 1 ELSE 0 END);
END;
$$;
CREATE FUNCTION public.menupro_reserve_checkout(p_business_id uuid,p_plan_id text,p_cycle text,p_purpose text DEFAULT 'subscription',p_accept_renewal boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_q jsonb; v_r public.menupro_checkout_requests; v_s public.menupro_subscriptions;
BEGIN
 PERFORM public.menupro_require_owner(p_business_id);
 SELECT * INTO v_s FROM public.menupro_subscriptions WHERE business_id=p_business_id FOR UPDATE;
 IF p_purpose='subscription' AND NOT p_accept_renewal THEN RAISE EXCEPTION 'Debes autorizar la renovación automática.' USING ERRCODE='P0001'; END IF;
 IF p_purpose='subscription' AND v_s.provider_subscription_id IS NOT NULL AND NOT v_s.cancel_at_period_end AND v_s.provider_status IN ('authorized','pending') THEN
  RAISE EXCEPTION 'Ya tienes una suscripción. Gestiona el plan existente.' USING ERRCODE='P0001'; END IF;
 IF (SELECT count(*) FROM public.menupro_checkout_requests WHERE business_id=p_business_id AND created_at>now()-interval '1 hour')>=10 THEN
  RAISE EXCEPTION 'Demasiadas solicitudes de pago. Inténtalo más tarde.' USING ERRCODE='P0001'; END IF;
 v_q:=public.menupro_quote(p_business_id,p_plan_id,p_cycle,p_purpose);
 SELECT * INTO v_r FROM public.menupro_checkout_requests WHERE business_id=p_business_id AND status IN ('pending','ready') AND created_at>now()-interval '30 minutes' FOR UPDATE LIMIT 1;
 IF v_r.id IS NOT NULL THEN
  IF v_r.plan_id=p_plan_id AND v_r.cycle=p_cycle AND v_r.purpose=p_purpose THEN RETURN to_jsonb(v_r); END IF;
  RAISE EXCEPTION 'Hay un proceso de contratación pendiente. Cancélalo antes de elegir otro plan.' USING ERRCODE='P0001';
 END IF;
 INSERT INTO public.menupro_checkout_requests(business_id,plan_id,cycle,purpose,net_amount,gross_amount,regular_gross,welcome,starts_at,created_by)
 VALUES(p_business_id,p_plan_id,p_cycle,p_purpose,(v_q->>'net_amount')::int,(v_q->>'gross_amount')::int,(v_q->>'regular_gross')::int,(v_q->>'welcome')::boolean,(v_q->>'starts_at')::timestamptz,auth.uid()) RETURNING * INTO v_r;
 INSERT INTO public.menupro_audit_events(business_id,actor_id,event,details) VALUES(p_business_id,auth.uid(),'checkout_requested',jsonb_build_object('request_id',v_r.id,'renewal_authorized',p_accept_renewal,'quote',v_q));
 RETURN to_jsonb(v_r);
END;
$$;

CREATE FUNCTION public.menupro_bind_checkout(p_secret text,p_request_id uuid,p_provider_id text,p_url text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
 PERFORM public.menupro_require_worker(p_secret);
 UPDATE public.menupro_checkout_requests SET provider_id=p_provider_id,checkout_url=p_url,status='ready' WHERE id=p_request_id AND status IN ('pending','ready') AND (provider_id IS NULL OR provider_id=p_provider_id);
 IF NOT FOUND THEN RAISE EXCEPTION 'No se pudo vincular el pago.' USING ERRCODE='P0001'; END IF;
END;
$$;
CREATE FUNCTION public.menupro_cancel_subscription(p_business_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
 PERFORM public.menupro_require_owner(p_business_id);
 UPDATE public.menupro_subscriptions SET cancel_at_period_end=true,provider_status='cancelled',updated_at=now() WHERE business_id=p_business_id;
 INSERT INTO public.menupro_audit_events(business_id,actor_id,event) VALUES(p_business_id,auth.uid(),'renewal_cancelled');
END;
$$;
CREATE FUNCTION public.menupro_schedule_downgrade(p_business_id uuid,p_restaurant_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
 PERFORM public.menupro_require_owner(p_business_id);
 PERFORM 1 FROM public.menupro_subscriptions WHERE business_id=p_business_id AND plan_id='grupo' AND current_period_end>now() FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.menupro_restaurants WHERE business_id=p_business_id AND id=p_restaurant_id AND archived_at IS NULL) THEN RAISE EXCEPTION 'Selecciona el restaurante que seguirá activo.' USING ERRCODE='P0001'; END IF;
 UPDATE public.menupro_subscriptions SET pending_plan_id='local',pending_restaurant_id=p_restaurant_id,updated_at=now() WHERE business_id=p_business_id;
 INSERT INTO public.menupro_audit_events(business_id,actor_id,event,details) VALUES(p_business_id,auth.uid(),'downgrade_scheduled',jsonb_build_object('restaurant_id',p_restaurant_id));
END;
$$;

CREATE FUNCTION public.menupro_provider_status(p_secret text,p_request_id uuid,p_provider_id text,p_status text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_r public.menupro_checkout_requests;
BEGIN
 PERFORM public.menupro_require_worker(p_secret);
 SELECT * INTO v_r FROM public.menupro_checkout_requests WHERE id=p_request_id AND provider_id=p_provider_id FOR UPDATE;
 IF v_r.id IS NULL OR v_r.purpose<>'subscription' THEN RAISE EXCEPTION 'Suscripción no reconocida.' USING ERRCODE='P0001'; END IF;
 IF p_status='authorized' THEN
  UPDATE public.menupro_checkout_requests SET status='authorized' WHERE id=v_r.id AND status IN ('pending','ready');
  -- Authorization alone never grants paid access or consumes the discount.
  UPDATE public.menupro_subscriptions SET provider_subscription_id=p_provider_id,provider_status=p_status,updated_at=now() WHERE business_id=v_r.business_id;
 ELSIF p_status IN ('cancelled','canceled','paused') THEN
  UPDATE public.menupro_checkout_requests SET status='cancelled' WHERE id=v_r.id;
  UPDATE public.menupro_subscriptions SET provider_status=p_status,cancel_at_period_end=true,updated_at=now()
   WHERE business_id=v_r.business_id AND provider_subscription_id=p_provider_id;
 END IF;
END;
$$;

CREATE FUNCTION public.menupro_apply_payment(p_secret text,p_request_id uuid,p_payment_id text,p_invoice_id text,p_status text,
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
 v_target:=CASE WHEN v_r.purpose='upgrade' THEN v_r.plan_id ELSE coalesce(v_s.pending_plan_id,CASE WHEN v_s.current_period_end IS NULL THEN v_r.plan_id ELSE v_s.plan_id END) END;
 SELECT * INTO v_plan FROM public.menupro_plans WHERE id=v_target;
 v_used:=v_s.welcome_payments_used;
 v_net:=CASE WHEN v_r.cycle='monthly' THEN v_plan.monthly_net ELSE v_plan.annual_net END;
 IF v_r.welcome AND ((v_r.cycle='monthly' AND v_used<3) OR (v_r.cycle='annual' AND v_used<1)) THEN
  v_net:=round(v_net*CASE WHEN v_r.cycle='monthly' THEN .8 ELSE .9 END);
 END IF;
 v_expected:=CASE WHEN v_r.purpose='upgrade' THEN v_r.gross_amount ELSE v_net+round(v_net*.19) END;
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
    WHEN v_s.status='past_due' AND v_s.grace_until>=p_approved_at THEN v_s.current_period_end
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
  UPDATE public.menupro_payment_events SET period_start=v_start,period_end=v_end WHERE provider_payment_id=p_payment_id;
  UPDATE public.menupro_checkout_requests SET status='paid' WHERE id=v_r.id;
  INSERT INTO public.menupro_audit_events(business_id,event,details) VALUES(v_r.business_id,'payment_approved',jsonb_build_object('payment_id',p_payment_id,'amount',p_amount,'period_end',v_end));
 ELSIF p_status IN ('refunded','charged_back') OR (p_refunded=p_amount AND p_refunded>0) THEN
  IF v_e.period_end IS NOT NULL AND v_s.current_period_end=v_e.period_end THEN
   UPDATE public.menupro_subscriptions SET status='suspended',current_period_end=least(current_period_end,now()),grace_until=NULL,updated_at=now() WHERE business_id=v_r.business_id;
  END IF;
  INSERT INTO public.menupro_audit_events(business_id,event,details) SELECT v_r.business_id,'payment_'||p_status,jsonb_build_object('payment_id',p_payment_id,'refunded',p_refunded)
   WHERE v_e.status IS DISTINCT FROM p_status OR v_e.refunded_amount IS DISTINCT FROM p_refunded;
 ELSIF p_status IN ('rejected','cancelled') AND v_s.current_period_end IS NOT NULL AND NOT v_s.cancel_at_period_end
  AND p_due_at>=v_s.current_period_start AND p_due_at<=v_s.current_period_end+interval '1 day' THEN
  UPDATE public.menupro_subscriptions SET status='past_due',grace_until=coalesce(grace_until,current_period_end+interval '7 days'),updated_at=now() WHERE business_id=v_r.business_id;
 END IF;
 RETURN jsonb_build_object('business_id',v_r.business_id,'status',p_status,'credited',v_end IS NOT NULL);
END;
$$;

-- Notifications are idempotent. Purging requires a notice at least 30 days old;
-- delayed workers therefore cannot delete data without first notifying the owner.
CREATE FUNCTION public.menupro_run_lifecycle(p_secret text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_s public.menupro_subscriptions; v_end timestamptz; v_count integer:=0;
BEGIN
 PERFORM public.menupro_require_worker(p_secret);
 PERFORM pg_advisory_xact_lock(7020161032);
 FOR v_s IN SELECT * FROM public.menupro_subscriptions WHERE content_deleted_at IS NULL FOR UPDATE LOOP
  IF v_s.trial_started_at IS NOT NULL AND v_s.current_period_end IS NULL THEN
   IF now()>=v_s.trial_started_at+interval '10 days' AND now()<v_s.trial_ends_at THEN
    INSERT INTO public.menupro_notifications(business_id,event_key,subject,message) VALUES(v_s.business_id,'trial_day_10','Tu demo termina pronto','Continúa con tu carta y aprovecha el descuento de bienvenida.') ON CONFLICT DO NOTHING;
   END IF;
   IF now()>=v_s.trial_started_at+interval '14 days' AND now()<v_s.trial_ends_at THEN
    INSERT INTO public.menupro_notifications(business_id,event_key,subject,message) VALUES(v_s.business_id,'trial_day_14','Tu demo termina mañana','Revisa los planes para mantener publicada tu carta.') ON CONFLICT DO NOTHING;
   END IF;
   IF now()>=v_s.trial_ends_at THEN
    INSERT INTO public.menupro_notifications(business_id,event_key,subject,message) VALUES(v_s.business_id,'trial_ended','Tu demo terminó','Tu contenido está guardado. Contrata para recuperar la publicación.') ON CONFLICT DO NOTHING;
   END IF;
   IF now()>=v_s.trial_ends_at+interval '5 days' THEN
    INSERT INTO public.menupro_notifications(business_id,event_key,subject,message) VALUES(v_s.business_id,'trial_plus_5','Puedes retomar tu carta','Revisa tu oferta de bienvenida antes de que termine su vigencia.') ON CONFLICT DO NOTHING;
   END IF;
  END IF;
  IF v_s.current_period_end<=now() AND NOT v_s.cancel_at_period_end AND v_s.provider_subscription_id IS NOT NULL AND v_s.status='active' THEN
   UPDATE public.menupro_subscriptions SET status='past_due',grace_until=v_s.current_period_end+interval '7 days' WHERE business_id=v_s.business_id;
   INSERT INTO public.menupro_notifications(business_id,event_key,subject,message) VALUES(v_s.business_id,'payment_due_'||v_s.current_period_end,'Revisa el pago de tu suscripción','Tienes siete días de gracia desde el vencimiento para regularizar el pago.') ON CONFLICT DO NOTHING;
  END IF;
  v_end:=greatest(v_s.trial_ends_at,v_s.current_period_end,v_s.grace_until,v_s.courtesy_until);
  IF NOT public.menupro_has_access(v_s.business_id) AND v_end IS NOT NULL AND now()>=v_end+interval '150 days' AND v_s.retention_notice_at IS NULL THEN
   INSERT INTO public.menupro_notifications(business_id,event_key,subject,message) VALUES(v_s.business_id,'retention_'||v_end,'Conservación de tu contenido','Descarga tus datos o reactiva MenuPro. Tu contenido podrá eliminarse en 30 días.') ON CONFLICT DO NOTHING;
   UPDATE public.menupro_subscriptions SET retention_notice_at=now() WHERE business_id=v_s.business_id;
  END IF;
  IF NOT public.menupro_has_access(v_s.business_id) AND v_end IS NOT NULL AND now()>=v_end+interval '180 days'
    AND v_s.retention_notice_at<=now()-interval '30 days'
    AND EXISTS(SELECT 1 FROM public.menupro_notifications WHERE business_id=v_s.business_id AND event_key='retention_'||v_end AND email_sent_at IS NOT NULL) THEN
   DELETE FROM public.menupro_menus WHERE restaurant_id IN (SELECT id FROM public.menupro_restaurants WHERE business_id=v_s.business_id);
   UPDATE public.menupro_restaurants SET active=false,archived_at=now() WHERE business_id=v_s.business_id;
   UPDATE public.menupro_subscriptions SET content_deleted_at=now() WHERE business_id=v_s.business_id;
   INSERT INTO public.menupro_audit_events(business_id,event) VALUES(v_s.business_id,'content_retention_expired');
  END IF;
  v_count:=v_count+1;
 END LOOP;
 DELETE FROM public.menupro_rate_limits WHERE window_start<now()-interval '2 days';
 RETURN jsonb_build_object('processed',v_count);
END;
$$;

CREATE FUNCTION public.menupro_worker_outbox(p_secret text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
 PERFORM public.menupro_require_worker(p_secret);
 RETURN jsonb_build_object('notifications',coalesce((SELECT jsonb_agg(jsonb_build_object('id',n.id,'subject',n.subject,'message',n.message,'email',u.email))
  FROM (SELECT * FROM public.menupro_notifications WHERE email_sent_at IS NULL ORDER BY created_at LIMIT 20) n
  JOIN public.menupro_businesses b ON b.id=n.business_id JOIN auth.users u ON u.id=b.owner_id WHERE u.email_verified),'[]'),
  'subscriptions',coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM (SELECT s.business_id,s.provider_subscription_id,s.pending_plan_id,s.welcome_cycle,s.welcome_payments_used,s.welcome_redeemed_at,
   s.billing_cycle,s.cancel_at_period_end,p.monthly_net,p.annual_net FROM public.menupro_subscriptions s
   JOIN public.menupro_plans p ON p.id=coalesce(s.pending_plan_id,s.plan_id) WHERE s.provider_subscription_id IS NOT NULL AND NOT s.cancel_at_period_end) t),'[]'));
END;
$$;
CREATE FUNCTION public.menupro_mark_email_sent(p_secret text,p_notification_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN PERFORM public.menupro_require_worker(p_secret); UPDATE public.menupro_notifications SET email_sent_at=now() WHERE id=p_notification_id; END;
$$;

-- A user saving their own content qualifies for the welcome offer, including
-- changes to dishes/sections in the sample menu. Reading never qualifies.
CREATE OR REPLACE FUNCTION public.menupro_track_menu_saved() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_business uuid;
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='menupro_menus' THEN
  IF TG_OP='INSERT' AND NEW.slug='carta-de-ejemplo' THEN RETURN NEW; END IF;
  v_business:=public.menupro_menu_business(NEW.id);
 ELSIF TG_TABLE_NAME='menupro_menu_sections' THEN v_business:=public.menupro_menu_business(NEW.menu_id);
 ELSE SELECT public.menupro_menu_business(s.menu_id) INTO v_business FROM public.menupro_menu_sections s WHERE s.id=NEW.section_id;
 END IF;
 UPDATE public.menupro_subscriptions SET first_menu_saved_at=coalesce(first_menu_saved_at,now()) WHERE business_id=v_business AND trial_started_at IS NOT NULL;
 RETURN NEW;
END;
$$;
DROP TRIGGER menupro_menu_saved ON public.menupro_menus;
CREATE TRIGGER menupro_menu_saved AFTER INSERT OR UPDATE ON public.menupro_menus FOR EACH ROW EXECUTE FUNCTION public.menupro_track_menu_saved();
CREATE TRIGGER menupro_section_saved AFTER UPDATE ON public.menupro_menu_sections FOR EACH ROW EXECUTE FUNCTION public.menupro_track_menu_saved();
CREATE TRIGGER menupro_dish_saved AFTER UPDATE ON public.menupro_menu_items FOR EACH ROW EXECUTE FUNCTION public.menupro_track_menu_saved();

DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN ('menupro_require_worker','menupro_rate_limit','menupro_rename_business','menupro_revoke_invitation','menupro_read_notification',
  'menupro_admin_overview','menupro_admin_review','menupro_admin_courtesy','menupro_admin_prepare','menupro_quote','menupro_reserve_checkout',
  'menupro_bind_checkout','menupro_cancel_subscription','menupro_schedule_downgrade','menupro_provider_status','menupro_apply_payment',
  'menupro_run_lifecycle','menupro_worker_outbox','menupro_mark_email_sent') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.signature);
  IF f.signature::text ~ '(require_worker|rate_limit|bind_checkout|provider_status|apply_payment|run_lifecycle|worker_outbox|mark_email_sent)' THEN
   EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon',f.signature);
  END IF;
 END LOOP;
END $$;
