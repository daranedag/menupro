-- The legacy creator is not the business owner. Removing a former owner's auth
-- account must not cascade into a restaurant that has been transferred.
ALTER TABLE public.menupro_restaurants DROP CONSTRAINT menupro_restaurants_owner_id_fkey;
ALTER TABLE public.menupro_restaurants ADD CONSTRAINT menupro_restaurants_owner_id_fkey
 FOREIGN KEY(owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE TABLE public.menupro_seed_guards (transaction_id bigint PRIMARY KEY);
ALTER TABLE public.menupro_seed_guards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.menupro_seed_guards FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.menupro_seed_sample(p_restaurant_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_menu uuid; v_section uuid;
BEGIN
 IF EXISTS(SELECT 1 FROM public.menupro_menus WHERE restaurant_id=p_restaurant_id) THEN RETURN; END IF;
 INSERT INTO public.menupro_seed_guards VALUES(txid_current());
 INSERT INTO public.menupro_menus(restaurant_id,name,slug,description) VALUES(p_restaurant_id,'Carta de ejemplo','carta-de-ejemplo','Contenido de ejemplo. Reemplaza estos platos y precios antes de publicar.') RETURNING id INTO v_menu;
 INSERT INTO public.menupro_menu_sections(menu_id,name,description) VALUES(v_menu,'Platos de ejemplo','Edita o elimina esta sección de muestra.') RETURNING id INTO v_section;
 INSERT INTO public.menupro_menu_items(section_id,name,description,price) VALUES(v_section,'Plato de ejemplo','Reemplaza este ejemplo por un plato de tu restaurante.',0);
 DELETE FROM public.menupro_seed_guards WHERE transaction_id=txid_current();
END;
$$;
REVOKE ALL ON FUNCTION public.menupro_seed_sample(uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.menupro_archive_restaurant(p_restaurant_id uuid,p_archive boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_business uuid; v_limit integer;
BEGIN
 SELECT business_id INTO v_business FROM public.menupro_restaurants WHERE id=p_restaurant_id;
 IF coalesce(public.menupro_business_role(v_business),'') NOT IN ('owner','manager') THEN RAISE EXCEPTION 'No tienes permiso.' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.menupro_subscriptions WHERE business_id=v_business FOR UPDATE;
 IF NOT public.menupro_has_access(v_business) THEN RAISE EXCEPTION 'Activa tu suscripción para gestionar los restaurantes.' USING ERRCODE='P0001'; END IF;
 IF NOT p_archive THEN
  SELECT max_restaurants INTO v_limit FROM public.menupro_plans WHERE id=public.menupro_effective_plan(v_business);
  IF (SELECT count(*) FROM public.menupro_restaurants WHERE business_id=v_business AND archived_at IS NULL AND id<>p_restaurant_id)>=v_limit THEN
   RAISE EXCEPTION 'No hay cupo en el plan para restaurar este restaurante.' USING ERRCODE='P0001'; END IF;
 END IF;
 UPDATE public.menupro_restaurants SET archived_at=CASE WHEN p_archive THEN now() ELSE NULL END,active=NOT p_archive WHERE id=p_restaurant_id;
 INSERT INTO public.menupro_audit_events(business_id,actor_id,event,details) VALUES(v_business,auth.uid(),CASE WHEN p_archive THEN 'restaurant_archived' ELSE 'restaurant_restored' END,jsonb_build_object('restaurant_id',p_restaurant_id));
END;
$$;
REVOKE ALL ON FUNCTION public.menupro_archive_restaurant(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.menupro_archive_restaurant(uuid,boolean) TO authenticated;

-- Sample and lifecycle refinements
CREATE OR REPLACE FUNCTION public.menupro_start_trial(p_business_id uuid,p_restaurant_id uuid,p_name text,p_phone text,p_address text,p_city text,
 p_unit text DEFAULT '',p_no_physical_location boolean DEFAULT false,p_accept_terms boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_s public.menupro_subscriptions; v_name text; v_phone text; v_address text; v_review boolean; v_menu uuid; v_section uuid;
BEGIN
 PERFORM public.menupro_require_owner(p_business_id);
 IF NOT p_accept_terms THEN RAISE EXCEPTION 'Debes aceptar las condiciones de la demo.' USING ERRCODE='P0001'; END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=auth.uid() AND email_verified) THEN RAISE EXCEPTION 'Verifica tu correo antes de activar la demo.' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_s FROM public.menupro_subscriptions WHERE business_id=p_business_id FOR UPDATE;
 IF v_s.trial_started_at IS NOT NULL OR v_s.status<>'unstarted' THEN RAISE EXCEPTION 'La demo ya fue utilizada o está en revisión.' USING ERRCODE='P0001'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.menupro_restaurants WHERE id=p_restaurant_id AND business_id=p_business_id AND archived_at IS NULL) THEN RAISE EXCEPTION 'Restaurante no encontrado.' USING ERRCODE='42501'; END IF;
 IF (SELECT count(*) FROM public.menupro_trial_claims WHERE actor_id=auth.uid() AND created_at>now()-interval '1 hour')>=3 THEN
   RAISE EXCEPTION 'Demasiadas solicitudes. Inténtalo más tarde.' USING ERRCODE='P0001'; END IF;
 v_name:=public.menupro_normalize(p_name); v_phone:=regexp_replace(p_phone,'[^0-9]','','g');
 IF length(v_phone)=9 AND left(v_phone,1)='9' THEN v_phone:='56'||v_phone; END IF;
 v_address:=public.menupro_normalize(p_city)||':'||public.menupro_normalize(p_address)||':'||public.menupro_normalize(p_unit);
 IF length(v_name)<2 OR length(v_phone)<8 OR length(v_phone)>15 OR (NOT p_no_physical_location AND (length(trim(p_address))<3 OR length(trim(p_city))<2)) THEN
   RAISE EXCEPTION 'Completa el nombre, teléfono y ubicación del negocio.' USING ERRCODE='P0001'; END IF;
 IF p_no_physical_location THEN v_address:=''; END IF;
 -- Serialize concurrent claims, including claims made by different users.
 PERFORM pg_advisory_xact_lock(7020161031);
 v_name:=encode(sha256(convert_to(v_name,'UTF8')),'hex');
 v_phone:=encode(sha256(convert_to(v_phone,'UTF8')),'hex');
 IF v_address<>'' THEN v_address:=encode(sha256(convert_to(v_address,'UTF8')),'hex'); END IF;
 SELECT EXISTS(SELECT 1 FROM public.menupro_trial_claims c WHERE c.business_id IS DISTINCT FROM p_business_id AND c.status IN ('granted','review') AND
  (c.actor_id=auth.uid() OR ((c.name_key=v_name)::int+(c.phone_key=v_phone)::int+(v_address<>'' AND c.address_key=v_address)::int)>=2)) INTO v_review;
 UPDATE public.menupro_restaurants SET name=trim(p_name),phone=trim(p_phone),address=trim(p_address),city=trim(p_city),unit=trim(p_unit),no_physical_location=p_no_physical_location WHERE id=p_restaurant_id;
 INSERT INTO public.menupro_trial_claims(business_id,actor_id,name_key,phone_key,address_key,status)
 VALUES(p_business_id,auth.uid(),v_name,v_phone,v_address,CASE WHEN v_review THEN 'review' ELSE 'granted' END);
 INSERT INTO public.menupro_audit_events(business_id,actor_id,event,details) VALUES(p_business_id,auth.uid(),'trial_requested',jsonb_build_object('terms_version','2026-10-31'));
 IF v_review THEN
   UPDATE public.menupro_subscriptions SET status='review',updated_at=now() WHERE business_id=p_business_id;
   RETURN jsonb_build_object('status','review','message','Necesitamos verificar los datos del local antes de activar la demo.');
 END IF;
 UPDATE public.menupro_subscriptions SET status='trial',trial_started_at=now(),trial_ends_at=now()+interval '15 days',updated_at=now() WHERE business_id=p_business_id;
 PERFORM public.menupro_seed_sample(p_restaurant_id);
 INSERT INTO public.menupro_audit_events(business_id,actor_id,event,details) VALUES(p_business_id,auth.uid(),'trial_started',jsonb_build_object('terms_version','2026-10-31'));
 INSERT INTO public.menupro_notifications(business_id,event_key,subject,message) VALUES(p_business_id,'trial_started','Tu demo de 15 días comenzó','Edita la carta de ejemplo y publica tu QR. No se realizará ningún cobro sin tu autorización.');
 RETURN jsonb_build_object('status','trial','ends_at',now()+interval '15 days');
END;
$$;

CREATE OR REPLACE FUNCTION public.menupro_admin_review(p_claim_id uuid,p_approve boolean,p_reason text) RETURNS void
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
  PERFORM public.menupro_seed_sample((SELECT id FROM public.menupro_restaurants WHERE business_id=v_c.business_id AND archived_at IS NULL ORDER BY created_at LIMIT 1));
 END IF;
 INSERT INTO public.menupro_audit_events(business_id,actor_id,event,details) VALUES(v_c.business_id,auth.uid(),'trial_reviewed',jsonb_build_object('approved',p_approve,'reason',p_reason));
 INSERT INTO public.menupro_notifications(business_id,event_key,subject,message) VALUES(v_c.business_id,'trial_review_'||p_claim_id,
  CASE WHEN p_approve THEN 'Tu demo está activa' ELSE 'Revisión de tu solicitud' END,
  CASE WHEN p_approve THEN 'Tienes 15 días para probar MenuPro sin tarjeta.' ELSE 'No fue posible conceder otra demo. Contacta a soporte para recuperar el acceso o contratar.' END);
END;
$$;

CREATE OR REPLACE FUNCTION public.menupro_track_menu_saved() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_business uuid;
BEGIN
 IF auth.uid() IS NULL OR EXISTS(SELECT 1 FROM public.menupro_seed_guards WHERE transaction_id=txid_current()) THEN RETURN NEW; END IF;
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

CREATE OR REPLACE FUNCTION public.menupro_run_lifecycle(p_secret text) RETURNS jsonb
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
  IF v_s.status IN ('active','past_due','cancelled','suspended') AND NOT public.menupro_has_access(v_s.business_id) AND v_s.current_period_end IS NOT NULL THEN
   INSERT INTO public.menupro_notifications(business_id,event_key,subject,message) VALUES(v_s.business_id,'access_suspended_'||v_s.current_period_end,'Tu publicación está suspendida','Puedes consultar y descargar tus datos. Regulariza tu suscripción para volver a editar y publicar.') ON CONFLICT DO NOTHING;
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

CREATE OR REPLACE FUNCTION public.menupro_schedule_downgrade(p_business_id uuid,p_restaurant_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
 PERFORM public.menupro_require_owner(p_business_id);
 PERFORM 1 FROM public.menupro_subscriptions WHERE business_id=p_business_id AND plan_id='grupo' AND current_period_end IS NOT NULL FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.menupro_restaurants WHERE business_id=p_business_id AND id=p_restaurant_id AND archived_at IS NULL) THEN RAISE EXCEPTION 'Selecciona el restaurante que seguirá activo.' USING ERRCODE='P0001'; END IF;
 UPDATE public.menupro_subscriptions SET pending_plan_id='local',pending_restaurant_id=p_restaurant_id,updated_at=now() WHERE business_id=p_business_id;
 INSERT INTO public.menupro_audit_events(business_id,actor_id,event,details) VALUES(p_business_id,auth.uid(),'downgrade_scheduled',jsonb_build_object('restaurant_id',p_restaurant_id));
END;
$$;
DROP TRIGGER menupro_section_saved ON public.menupro_menu_sections;
DROP TRIGGER menupro_dish_saved ON public.menupro_menu_items;
CREATE TRIGGER menupro_section_saved AFTER INSERT OR UPDATE ON public.menupro_menu_sections FOR EACH ROW EXECUTE FUNCTION public.menupro_track_menu_saved();
CREATE TRIGGER menupro_dish_saved AFTER INSERT OR UPDATE ON public.menupro_menu_items FOR EACH ROW EXECUTE FUNCTION public.menupro_track_menu_saved();
