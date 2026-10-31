ALTER TABLE public.menupro_subscriptions ADD COLUMN courtesy_plan_id text REFERENCES public.menupro_plans(id);
CREATE FUNCTION public.menupro_effective_plan(p_business_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
 SELECT CASE WHEN s.courtesy_until>now() AND coalesce(c.max_restaurants,0)>p.max_restaurants THEN coalesce(s.courtesy_plan_id,s.plan_id)
  ELSE s.plan_id END FROM public.menupro_subscriptions s JOIN public.menupro_plans p ON p.id=s.plan_id
  LEFT JOIN public.menupro_plans c ON c.id=s.courtesy_plan_id WHERE s.business_id=p_business_id;
$$;
CREATE FUNCTION public.menupro_restaurant_entitled(p_restaurant_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.menupro_restaurants r WHERE r.id=p_restaurant_id AND r.archived_at IS NULL AND public.menupro_has_access(r.business_id)
   AND r.id IN (SELECT allowed.id FROM public.menupro_restaurants allowed WHERE allowed.business_id=r.business_id AND allowed.archived_at IS NULL
    ORDER BY allowed.created_at,allowed.id LIMIT (SELECT max_restaurants FROM public.menupro_plans WHERE id=public.menupro_effective_plan(r.business_id))));
$$;
CREATE OR REPLACE FUNCTION public.menupro_can_edit_restaurant(p_restaurant_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.menupro_restaurants r WHERE r.id=p_restaurant_id AND public.menupro_business_role(r.business_id) IS NOT NULL
  AND public.menupro_restaurant_entitled(r.id));
$$;
CREATE OR REPLACE FUNCTION public.menupro_public_menu(p_restaurant_slug text,p_menu_slug text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
 SELECT CASE WHEN NOT public.menupro_restaurant_entitled(r.id) THEN jsonb_build_object('unavailable',true)
  ELSE public.menupro_public_menu_content(p_restaurant_slug,p_menu_slug) END
 FROM public.menupro_restaurants r JOIN public.menupro_menus m ON m.restaurant_id=r.id
 WHERE r.slug=p_restaurant_slug AND m.slug=p_menu_slug AND r.active AND m.is_published AND m.active AND m.visible;
$$;
CREATE OR REPLACE FUNCTION public.menupro_admin_courtesy(p_business_id uuid,p_plan_id text,p_days integer,p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
 IF NOT public.menupro_is_admin() THEN RAISE EXCEPTION 'No tienes permiso.' USING ERRCODE='42501'; END IF;
 IF p_days NOT BETWEEN 1 AND 366 OR length(trim(p_reason))<5 OR p_plan_id NOT IN ('local','grupo') THEN RAISE EXCEPTION 'Cortesía inválida.' USING ERRCODE='P0001'; END IF;
 UPDATE public.menupro_subscriptions SET courtesy_plan_id=p_plan_id,courtesy_until=greatest(now(),coalesce(courtesy_until,now()))+make_interval(days=>p_days),updated_at=now() WHERE business_id=p_business_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Negocio no encontrado.' USING ERRCODE='P0001'; END IF;
 INSERT INTO public.menupro_audit_events(business_id,actor_id,event,details) VALUES(p_business_id,auth.uid(),'courtesy_granted',jsonb_build_object('days',p_days,'plan',p_plan_id,'reason',p_reason));
END;
$$;
CREATE FUNCTION public.menupro_admin_claim_details(p_claim_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_c public.menupro_trial_claims;
BEGIN
 IF NOT public.menupro_is_admin() THEN RAISE EXCEPTION 'No tienes permiso.' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_c FROM public.menupro_trial_claims WHERE id=p_claim_id;
 RETURN jsonb_build_object('requested',coalesce((SELECT jsonb_agg(jsonb_build_object('name',r.name,'phone',r.phone,'address',r.address,'city',r.city,'unit',r.unit))
   FROM public.menupro_restaurants r WHERE r.business_id=v_c.business_id),'[]'),
  'matches',coalesce((SELECT jsonb_agg(jsonb_build_object('business_id',c.business_id,'name',b.name,'status',c.status,'created_at',c.created_at,
    'restaurants',(SELECT jsonb_agg(jsonb_build_object('name',r.name,'phone',r.phone,'address',r.address,'city',r.city,'unit',r.unit)) FROM public.menupro_restaurants r WHERE r.business_id=c.business_id)))
   FROM public.menupro_trial_claims c LEFT JOIN public.menupro_businesses b ON b.id=c.business_id WHERE c.id<>v_c.id
    AND c.business_id IS DISTINCT FROM v_c.business_id AND c.status IN ('review','granted') AND
     (c.actor_id=v_c.actor_id OR ((c.name_key=v_c.name_key)::int+(c.phone_key=v_c.phone_key)::int+(c.address_key<>'' AND c.address_key=v_c.address_key)::int)>=2)),'[]'));
END;
$$;
CREATE OR REPLACE FUNCTION public.menupro_admin_prepaid(p_business_id uuid,p_plan_id text,p_cycle text,p_reference text,p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_id uuid; v_start timestamptz; v_end timestamptz; v_s public.menupro_subscriptions; v_p public.menupro_plans; v_net integer; v_regular integer; v_welcome boolean;
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
 INSERT INTO public.menupro_checkout_requests(business_id,plan_id,cycle,purpose,net_amount,gross_amount,regular_gross,starts_at,status,created_by,welcome)
 VALUES(p_business_id,p_plan_id,p_cycle,'prepaid',v_net,v_net+round(v_net*.19),v_regular+round(v_regular*.19),v_start,'paid',auth.uid(),v_welcome) RETURNING id INTO v_id;
 INSERT INTO public.menupro_payment_events(provider_payment_id,request_id,business_id,status,amount,currency,period_start,period_end,approved_at,provider_modified_at)
 VALUES('bank:'||trim(p_reference),v_id,p_business_id,'approved',v_net+round(v_net*.19),'CLP',v_start,v_end,now(),now());
 UPDATE public.menupro_subscriptions SET plan_id=p_plan_id,status='active',billing_cycle=p_cycle,current_period_start=v_start,current_period_end=v_end,
  grace_until=NULL,cancel_at_period_end=true,pending_plan_id=NULL,pending_restaurant_id=NULL,retention_notice_at=NULL,content_deleted_at=NULL,
  welcome_redeemed_at=CASE WHEN v_welcome THEN coalesce(welcome_redeemed_at,now()) ELSE welcome_redeemed_at END,
  welcome_cycle=CASE WHEN v_welcome THEN coalesce(welcome_cycle,p_cycle) ELSE welcome_cycle END,
  welcome_payments_used=welcome_payments_used+CASE WHEN v_welcome THEN 1 ELSE 0 END,updated_at=now() WHERE business_id=p_business_id;
 IF v_s.pending_restaurant_id IS NOT NULL AND p_plan_id='local' THEN UPDATE public.menupro_restaurants SET archived_at=now() WHERE business_id=p_business_id AND id<>v_s.pending_restaurant_id AND archived_at IS NULL; END IF;
 INSERT INTO public.menupro_audit_events(business_id,actor_id,event,details) VALUES(p_business_id,auth.uid(),'bank_payment_confirmed',jsonb_build_object('reference',p_reference,'reason',p_reason,'period_end',v_end));
 RETURN jsonb_build_object('ends_at',v_end,'gross_amount',v_net+round(v_net*.19));
END;
$$;
REVOKE ALL ON FUNCTION public.menupro_effective_plan(uuid),public.menupro_restaurant_entitled(uuid),public.menupro_admin_claim_details(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.menupro_effective_plan(uuid),public.menupro_restaurant_entitled(uuid),public.menupro_admin_claim_details(uuid) TO authenticated;

-- Effective-plan projections
CREATE OR REPLACE FUNCTION public.menupro_session(p_business_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_id uuid; v_subscription jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Debes iniciar sesión.' USING ERRCODE='42501'; END IF;
 v_id:=public.menupro_ensure_business();
 IF public.menupro_business_role(p_business_id) IS NOT NULL THEN v_id:=p_business_id; END IF;
 UPDATE public.menupro_trial_claims SET last_activity_at=now() WHERE business_id=v_id AND last_activity_at<now()-interval '1 day';
 SELECT to_jsonb(s)||jsonb_build_object('has_access',public.menupro_has_access(v_id),
   'plan_name',p.name,'effective_plan_id',public.menupro_effective_plan(v_id),'max_restaurants',CASE WHEN s.courtesy_until>now() THEN p.max_restaurants WHEN s.status IN ('unstarted','review','trial') THEN 1 ELSE p.max_restaurants END,
   'grace_until',coalesce(s.grace_until,CASE WHEN NOT s.cancel_at_period_end AND s.provider_subscription_id IS NOT NULL THEN s.current_period_end+interval '7 days' END),
   'effective_status',CASE WHEN public.menupro_has_access(v_id) THEN CASE WHEN s.status='active' AND s.current_period_end<=now() THEN 'past_due' ELSE s.status END
      WHEN s.status IN ('unstarted','review') THEN s.status ELSE 'expired' END,
   'welcome_eligible',s.trial_started_at IS NOT NULL AND s.first_menu_saved_at IS NOT NULL
      AND s.welcome_redeemed_at IS NULL AND now()<=s.trial_ends_at+interval '7 days') INTO v_subscription
 FROM public.menupro_subscriptions s JOIN public.menupro_plans p ON p.id=public.menupro_effective_plan(v_id) WHERE s.business_id=v_id;
 RETURN jsonb_build_object('business_id',v_id,'business_role',public.menupro_business_role(v_id),'is_admin',public.menupro_is_admin(),
   'businesses',coalesce((SELECT jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,'role',m.role) ORDER BY b.created_at)
      FROM public.menupro_businesses b JOIN public.menupro_memberships m ON b.id=m.business_id WHERE m.user_id=auth.uid()),'[]'),
   'restaurants',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'business_id',r.business_id,'name',r.name,'slug',r.slug,
       'phone',r.phone,'address',r.address,'city',r.city,'unit',r.unit,'no_physical_location',r.no_physical_location,
       'entitled',public.menupro_restaurant_entitled(r.id),'currency',r.currency,'theme',r.theme,'active',r.active,'archived_at',r.archived_at) ORDER BY r.created_at)
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
    pending_plan_id=NULL,pending_restaurant_id=NULL,retention_notice_at=NULL,content_deleted_at=NULL,updated_at=now() WHERE business_id=v_r.business_id;
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

CREATE OR REPLACE FUNCTION public.menupro_create_restaurant(p_business_id uuid,p_name text,p_slug text,p_phone text DEFAULT '',
 p_address text DEFAULT '',p_city text DEFAULT '',p_unit text DEFAULT '',p_no_physical_location boolean DEFAULT false) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_limit integer; v_status text; v_id uuid;
BEGIN
 IF coalesce(public.menupro_business_role(p_business_id),'') NOT IN ('owner','manager') THEN RAISE EXCEPTION 'No tienes permiso.' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.menupro_businesses WHERE id=p_business_id FOR UPDATE;
 SELECT CASE WHEN s.courtesy_until>now() THEN p.max_restaurants WHEN s.status IN ('unstarted','review','trial') THEN 1 ELSE p.max_restaurants END,s.status INTO v_limit,v_status
 FROM public.menupro_subscriptions s JOIN public.menupro_plans p ON p.id=public.menupro_effective_plan(p_business_id) WHERE s.business_id=p_business_id;
 IF length(trim(p_name)) NOT BETWEEN 1 AND 255 OR length(p_phone)>255 OR length(p_address)>255 OR length(p_city)>255 OR length(p_unit)>255 THEN RAISE EXCEPTION 'Datos del restaurante inválidos.' USING ERRCODE='P0001'; END IF;
 IF v_status NOT IN ('unstarted','review') AND NOT public.menupro_has_access(p_business_id) THEN
   RAISE EXCEPTION 'Activa una suscripción para crear restaurantes.' USING ERRCODE='P0001'; END IF;
 IF (SELECT count(*) FROM public.menupro_restaurants WHERE business_id=p_business_id AND archived_at IS NULL)>=v_limit THEN
   RAISE EXCEPTION 'Has alcanzado el límite de restaurantes de tu plan.' USING ERRCODE='P0001'; END IF;
 INSERT INTO public.menupro_restaurants(business_id,owner_id,name,slug,phone,address,city,unit,no_physical_location)
 VALUES(p_business_id,auth.uid(),trim(p_name),p_slug,trim(p_phone),trim(p_address),trim(p_city),trim(p_unit),p_no_physical_location) RETURNING id INTO v_id;
 RETURN v_id;
END;
$$;
