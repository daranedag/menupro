ALTER TABLE public.menupro_trial_claims ADD COLUMN last_activity_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX menupro_trial_claims_activity_idx ON public.menupro_trial_claims(last_activity_at);
ALTER TABLE public.menupro_notifications ADD COLUMN delivery_token uuid;
ALTER TABLE public.menupro_notifications ADD COLUMN delivery_lease_until timestamptz;
ALTER TABLE public.menupro_checkout_requests ADD COLUMN creation_token uuid;
ALTER TABLE public.menupro_checkout_requests ADD COLUMN creation_lease_until timestamptz;

CREATE FUNCTION public.menupro_claim_checkout(p_secret text,p_request_id uuid,p_token uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
 PERFORM public.menupro_require_worker(p_secret);
 UPDATE public.menupro_checkout_requests SET creation_token=p_token,creation_lease_until=now()+interval '90 seconds'
 WHERE id=p_request_id AND checkout_url IS NULL AND status='pending' AND (creation_lease_until IS NULL OR creation_lease_until<now());
 RETURN FOUND;
END;
$$;
CREATE FUNCTION public.menupro_release_checkout(p_secret text,p_request_id uuid,p_token uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
 PERFORM public.menupro_require_worker(p_secret);
 UPDATE public.menupro_checkout_requests SET creation_token=NULL,creation_lease_until=NULL WHERE id=p_request_id AND creation_token=p_token;
END;
$$;
CREATE FUNCTION public.menupro_claim_notifications(p_secret text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_result jsonb;
BEGIN
 PERFORM public.menupro_require_worker(p_secret);
 WITH candidates AS (SELECT n.id FROM public.menupro_notifications n JOIN public.menupro_businesses b ON b.id=n.business_id
   JOIN auth.users u ON u.id=b.owner_id WHERE n.email_sent_at IS NULL AND (n.delivery_lease_until IS NULL OR n.delivery_lease_until<now()) AND u.email_verified
   ORDER BY n.created_at LIMIT 20 FOR UPDATE OF n SKIP LOCKED), claimed AS (
  UPDATE public.menupro_notifications n SET delivery_token=gen_random_uuid(),delivery_lease_until=now()+interval '10 minutes'
   FROM candidates c WHERE n.id=c.id RETURNING n.*)
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',n.id,'token',n.delivery_token,'subject',n.subject,'message',n.message,'email',u.email)),'[]') INTO v_result
  FROM claimed n JOIN public.menupro_businesses b ON b.id=n.business_id JOIN auth.users u ON u.id=b.owner_id;
 RETURN v_result;
END;
$$;
CREATE FUNCTION public.menupro_complete_notification(p_secret text,p_notification_id uuid,p_token uuid,p_sent boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
 PERFORM public.menupro_require_worker(p_secret);
 UPDATE public.menupro_notifications SET email_sent_at=CASE WHEN p_sent THEN now() ELSE email_sent_at END,delivery_token=NULL,delivery_lease_until=NULL
 WHERE id=p_notification_id AND delivery_token=p_token;
END;
$$;
CREATE FUNCTION public.menupro_expire_abuse_history(p_secret text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_count integer;
BEGIN
 PERFORM public.menupro_require_worker(p_secret);
 DELETE FROM public.menupro_trial_claims WHERE last_activity_at<now()-interval '24 months';
 GET DIAGNOSTICS v_count=ROW_COUNT;
 RETURN v_count;
END;
$$;
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN ('menupro_claim_checkout','menupro_release_checkout','menupro_claim_notifications','menupro_complete_notification','menupro_expire_abuse_history') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon,authenticated',f.signature);
 END LOOP;
END $$;

-- Refined definitions
CREATE OR REPLACE FUNCTION public.menupro_session(p_business_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_id uuid; v_subscription jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Debes iniciar sesión.' USING ERRCODE='42501'; END IF;
 v_id:=public.menupro_ensure_business();
 IF public.menupro_business_role(p_business_id) IS NOT NULL THEN v_id:=p_business_id; END IF;
 UPDATE public.menupro_trial_claims SET last_activity_at=now() WHERE business_id=v_id AND last_activity_at<now()-interval '1 day';
 SELECT to_jsonb(s)||jsonb_build_object('has_access',public.menupro_has_access(v_id),
   'plan_name',p.name,'max_restaurants',CASE WHEN s.courtesy_until>now() THEN p.max_restaurants WHEN s.status IN ('unstarted','review','trial') THEN 1 ELSE p.max_restaurants END,
   'grace_until',coalesce(s.grace_until,CASE WHEN NOT s.cancel_at_period_end AND s.provider_subscription_id IS NOT NULL THEN s.current_period_end+interval '7 days' END),
   'effective_status',CASE WHEN public.menupro_has_access(v_id) THEN CASE WHEN s.status='active' AND s.current_period_end<=now() THEN 'past_due' ELSE s.status END
      WHEN s.status IN ('unstarted','review') THEN s.status ELSE 'expired' END,
   'welcome_eligible',s.trial_started_at IS NOT NULL AND s.first_menu_saved_at IS NOT NULL
      AND s.welcome_redeemed_at IS NULL AND now()<=s.trial_ends_at+interval '7 days') INTO v_subscription
 FROM public.menupro_subscriptions s JOIN public.menupro_plans p ON p.id=s.plan_id WHERE s.business_id=v_id;
 RETURN jsonb_build_object('business_id',v_id,'business_role',public.menupro_business_role(v_id),'is_admin',public.menupro_is_admin(),
   'businesses',coalesce((SELECT jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,'role',m.role) ORDER BY b.created_at)
      FROM public.menupro_businesses b JOIN public.menupro_memberships m ON b.id=m.business_id WHERE m.user_id=auth.uid()),'[]'),
   'restaurants',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'business_id',r.business_id,'name',r.name,'slug',r.slug,
       'phone',r.phone,'address',r.address,'city',r.city,'unit',r.unit,'no_physical_location',r.no_physical_location,
       'currency',r.currency,'theme',r.theme,'active',r.active,'archived_at',r.archived_at) ORDER BY r.created_at)
      FROM public.menupro_restaurants r WHERE r.business_id=v_id),'[]'),
   'subscription',v_subscription,
   'invitations',coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'business_name',b.name,'role',i.role,'expires_at',i.expires_at))
      FROM public.menupro_invitations i JOIN public.menupro_businesses b ON b.id=i.business_id
      JOIN auth.users u ON lower(u.email)=i.email WHERE u.id=auth.uid() AND u.email_verified
       AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>now()),'[]'));
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
   IF v_r.purpose='upgrade' THEN
    UPDATE public.menupro_subscriptions SET plan_id='local',updated_at=now() WHERE business_id=v_r.business_id;
    UPDATE public.menupro_restaurants SET archived_at=now() WHERE business_id=v_r.business_id AND archived_at IS NULL AND id<>(SELECT id FROM public.menupro_restaurants WHERE business_id=v_r.business_id AND archived_at IS NULL ORDER BY created_at,id LIMIT 1);
   ELSE
    UPDATE public.menupro_subscriptions SET status='suspended',current_period_end=least(current_period_end,now()),grace_until=NULL,updated_at=now() WHERE business_id=v_r.business_id;
   END IF;
  END IF;
  INSERT INTO public.menupro_audit_events(business_id,event,details) SELECT v_r.business_id,'payment_'||p_status,jsonb_build_object('payment_id',p_payment_id,'refunded',p_refunded)
   WHERE v_e.status IS DISTINCT FROM p_status OR v_e.refunded_amount IS DISTINCT FROM p_refunded;
 ELSIF p_status='approved' AND v_e.status='charged_back' AND v_e.period_end>now() AND v_r.purpose<>'upgrade' THEN
  UPDATE public.menupro_subscriptions SET status='active',current_period_end=greatest(current_period_end,v_e.period_end),updated_at=now() WHERE business_id=v_r.business_id AND plan_id=v_r.plan_id;
 ELSIF p_refunded>0 AND p_refunded<p_amount AND v_e.refunded_amount IS DISTINCT FROM p_refunded THEN
  INSERT INTO public.menupro_audit_events(business_id,event,details) VALUES(v_r.business_id,'partial_refund_review',jsonb_build_object('payment_id',p_payment_id,'refunded',p_refunded,'reason','Requiere especificar el servicio o período conservado.'));
 ELSIF p_status IN ('rejected','cancelled') AND v_s.current_period_end IS NOT NULL AND NOT v_s.cancel_at_period_end
  AND p_due_at>=v_s.current_period_start AND p_due_at<=v_s.current_period_end+interval '1 day' THEN
  UPDATE public.menupro_subscriptions SET status='past_due',grace_until=coalesce(grace_until,current_period_end+interval '7 days'),updated_at=now() WHERE business_id=v_r.business_id;
 END IF;
 RETURN jsonb_build_object('business_id',v_r.business_id,'status',p_status,'credited',v_end IS NOT NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.menupro_reserve_checkout(p_business_id uuid,p_plan_id text,p_cycle text,p_purpose text DEFAULT 'subscription',p_accept_renewal boolean DEFAULT false) RETURNS jsonb
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
 IF (SELECT count(*) FROM public.menupro_restaurants WHERE business_id=p_business_id AND archived_at IS NULL)>(SELECT max_restaurants FROM public.menupro_plans WHERE id=p_plan_id) AND v_s.pending_restaurant_id IS NULL THEN
  RAISE EXCEPTION 'Selecciona primero qué restaurante permanecerá activo al reducir el plan.' USING ERRCODE='P0001'; END IF;
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
