-- Business ownership, entitlements and trials are enforced in PostgreSQL, including
-- callers using the public SDK directly. No billing fields are client-writable.
CREATE TABLE public.menupro_admins (
  email text PRIMARY KEY CHECK (email = lower(email))
);
INSERT INTO public.menupro_admins VALUES ('daranedag@gmail.com');
ALTER TABLE public.menupro_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.menupro_admins FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.menupro_is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users u JOIN public.menupro_admins a ON lower(u.email)=a.email
    WHERE u.id=auth.uid() AND u.email_verified);
$$;

CREATE TABLE public.menupro_businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 255),
  owner_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX menupro_businesses_owner_idx ON public.menupro_businesses(owner_id);
CREATE TABLE public.menupro_memberships (
  business_id uuid NOT NULL REFERENCES public.menupro_businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','manager','editor')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id,user_id)
);
CREATE UNIQUE INDEX menupro_memberships_single_owner_idx ON public.menupro_memberships(business_id) WHERE role='owner';
CREATE INDEX menupro_memberships_user_idx ON public.menupro_memberships(user_id,business_id);
CREATE TABLE public.menupro_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.menupro_businesses(id) ON DELETE CASCADE,
  email text NOT NULL CHECK (email=lower(email)),
  role text NOT NULL CHECK (role IN ('owner','manager','editor')),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days',
  accepted_at timestamptz,
  revoked_at timestamptz
);
CREATE INDEX menupro_invitations_email_idx ON public.menupro_invitations(email,expires_at);
CREATE INDEX menupro_invitations_business_idx ON public.menupro_invitations(business_id);

CREATE TABLE public.menupro_plans (
  id text PRIMARY KEY CHECK (id IN ('local','grupo')),
  name text NOT NULL,
  monthly_net integer NOT NULL CHECK (monthly_net>0),
  annual_net integer NOT NULL CHECK (annual_net>0),
  max_restaurants integer NOT NULL CHECK (max_restaurants>0),
  currency text NOT NULL DEFAULT 'CLP' CHECK (currency='CLP')
);
INSERT INTO public.menupro_plans VALUES ('local','Local',9990,99900,1,'CLP'),('grupo','Grupo',24990,249900,3,'CLP');
CREATE TABLE public.menupro_subscriptions (
  business_id uuid PRIMARY KEY REFERENCES public.menupro_businesses(id) ON DELETE CASCADE,
  plan_id text NOT NULL DEFAULT 'local' REFERENCES public.menupro_plans(id),
  status text NOT NULL DEFAULT 'unstarted' CHECK (status IN ('unstarted','review','trial','active','past_due','suspended','cancelled')),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  first_menu_saved_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  grace_until timestamptz,
  courtesy_until timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  billing_cycle text CHECK (billing_cycle IN ('monthly','annual')),
  pending_plan_id text REFERENCES public.menupro_plans(id),
  pending_restaurant_id uuid,
  provider_subscription_id text UNIQUE,
  provider_status text,
  welcome_redeemed_at timestamptz,
  welcome_cycle text CHECK (welcome_cycle IN ('monthly','annual')),
  welcome_payments_used integer NOT NULL DEFAULT 0 CHECK (welcome_payments_used>=0),
  retention_notice_at timestamptz,
  content_deleted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.menupro_restaurants ADD COLUMN business_id uuid REFERENCES public.menupro_businesses(id) ON DELETE RESTRICT;
ALTER TABLE public.menupro_restaurants ADD COLUMN unit text NOT NULL DEFAULT '';
ALTER TABLE public.menupro_restaurants ADD COLUMN no_physical_location boolean NOT NULL DEFAULT false;
ALTER TABLE public.menupro_restaurants ADD COLUMN archived_at timestamptz;
ALTER TABLE public.menupro_restaurants ALTER COLUMN owner_id DROP NOT NULL;
CREATE INDEX menupro_restaurants_business_idx ON public.menupro_restaurants(business_id);
-- Preserve existing restaurants and their slugs while moving ownership to a business.
INSERT INTO public.menupro_businesses(name,owner_id,created_by)
  SELECT 'Mi negocio',owner_id,owner_id FROM public.menupro_restaurants GROUP BY owner_id;
INSERT INTO public.menupro_memberships(business_id,user_id,role)
  SELECT id,owner_id,'owner' FROM public.menupro_businesses;
INSERT INTO public.menupro_subscriptions(business_id) SELECT id FROM public.menupro_businesses;
UPDATE public.menupro_restaurants r SET business_id=b.id FROM public.menupro_businesses b WHERE b.owner_id=r.owner_id;
ALTER TABLE public.menupro_restaurants ALTER COLUMN business_id SET NOT NULL;

CREATE TABLE public.menupro_trial_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.menupro_businesses(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name_key text NOT NULL, phone_key text NOT NULL, address_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('review','granted','denied')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text
);
CREATE INDEX menupro_trial_claims_business_idx ON public.menupro_trial_claims(business_id);
CREATE INDEX menupro_trial_claims_phone_idx ON public.menupro_trial_claims(phone_key);
CREATE INDEX menupro_trial_claims_address_idx ON public.menupro_trial_claims(address_key);
CREATE INDEX menupro_trial_claims_actor_idx ON public.menupro_trial_claims(actor_id,created_at);
CREATE TABLE public.menupro_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.menupro_businesses(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX menupro_audit_events_business_idx ON public.menupro_audit_events(business_id,created_at);
CREATE TABLE public.menupro_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.menupro_businesses(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  email_sent_at timestamptz,
  UNIQUE(business_id,event_key)
);
CREATE INDEX menupro_notifications_business_idx ON public.menupro_notifications(business_id,created_at);

CREATE FUNCTION public.menupro_business_role(p_business_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT role FROM public.menupro_memberships WHERE business_id=p_business_id AND user_id=auth.uid();
$$;
CREATE FUNCTION public.menupro_has_access(p_business_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.menupro_subscriptions s WHERE s.business_id=p_business_id AND (
    s.courtesy_until>now() OR (s.status='trial' AND s.trial_ends_at>now()) OR
    (s.status IN ('active','past_due','cancelled') AND s.current_period_end>now()) OR
    (s.status='past_due' AND s.grace_until>now())));
$$;
CREATE FUNCTION public.menupro_can_edit_restaurant(p_restaurant_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.menupro_restaurants r WHERE r.id=p_restaurant_id AND r.archived_at IS NULL
    AND public.menupro_business_role(r.business_id) IS NOT NULL AND public.menupro_has_access(r.business_id));
$$;
CREATE FUNCTION public.menupro_menu_business(p_menu_id uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
 SELECT r.business_id FROM public.menupro_restaurants r JOIN public.menupro_menus m ON m.restaurant_id=r.id WHERE m.id=p_menu_id;
$$;
CREATE FUNCTION public.menupro_normalize(p_value text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, public, pg_temp AS $$
 SELECT regexp_replace(translate(lower(trim(coalesce(p_value,''))),'áéíóúüñ','aeiouun'),'[^a-z0-9]','','g');
$$;
CREATE FUNCTION public.menupro_require_owner(p_business_id uuid) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
 IF public.menupro_business_role(p_business_id) IS DISTINCT FROM 'owner' THEN
   RAISE EXCEPTION 'Solo el propietario puede realizar esta operación.' USING ERRCODE='42501';
 END IF;
END;
$$;

CREATE FUNCTION public.menupro_ensure_business(p_name text DEFAULT 'Mi negocio') RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_id uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Debes iniciar sesión.' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 SELECT business_id INTO v_id FROM public.menupro_memberships WHERE user_id=auth.uid() ORDER BY created_at LIMIT 1;
 IF v_id IS NOT NULL THEN RETURN v_id; END IF;
 INSERT INTO public.menupro_businesses(name,owner_id,created_by) VALUES (left(trim(p_name),255),auth.uid(),auth.uid()) RETURNING id INTO v_id;
 INSERT INTO public.menupro_memberships VALUES (v_id,auth.uid(),'owner',now());
 INSERT INTO public.menupro_subscriptions(business_id) VALUES(v_id);
 RETURN v_id;
END;
$$;

CREATE FUNCTION public.menupro_session(p_business_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_id uuid; v_subscription jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Debes iniciar sesión.' USING ERRCODE='42501'; END IF;
 v_id:=public.menupro_ensure_business();
 IF public.menupro_business_role(p_business_id) IS NOT NULL THEN v_id:=p_business_id; END IF;
 SELECT to_jsonb(s)||jsonb_build_object('has_access',public.menupro_has_access(v_id),
   'plan_name',p.name,'max_restaurants',CASE WHEN s.status IN ('unstarted','review','trial') THEN 1 ELSE p.max_restaurants END,
   'effective_status',CASE WHEN public.menupro_has_access(v_id) THEN s.status
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

CREATE FUNCTION public.menupro_create_restaurant(p_business_id uuid,p_name text,p_slug text,p_phone text DEFAULT '',
 p_address text DEFAULT '',p_city text DEFAULT '',p_unit text DEFAULT '',p_no_physical_location boolean DEFAULT false) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_limit integer; v_status text; v_id uuid;
BEGIN
 IF coalesce(public.menupro_business_role(p_business_id),'') NOT IN ('owner','manager') THEN RAISE EXCEPTION 'No tienes permiso.' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.menupro_businesses WHERE id=p_business_id FOR UPDATE;
 SELECT CASE WHEN s.status IN ('unstarted','review','trial') THEN 1 ELSE p.max_restaurants END,s.status INTO v_limit,v_status
 FROM public.menupro_subscriptions s JOIN public.menupro_plans p ON p.id=s.plan_id WHERE s.business_id=p_business_id;
 IF v_status NOT IN ('unstarted','review') AND NOT public.menupro_has_access(p_business_id) THEN
   RAISE EXCEPTION 'Activa una suscripción para crear restaurantes.' USING ERRCODE='P0001'; END IF;
 IF (SELECT count(*) FROM public.menupro_restaurants WHERE business_id=p_business_id AND archived_at IS NULL)>=v_limit THEN
   RAISE EXCEPTION 'Has alcanzado el límite de restaurantes de tu plan.' USING ERRCODE='P0001'; END IF;
 INSERT INTO public.menupro_restaurants(business_id,owner_id,name,slug,phone,address,city,unit,no_physical_location)
 VALUES(p_business_id,auth.uid(),trim(p_name),p_slug,trim(p_phone),trim(p_address),trim(p_city),trim(p_unit),p_no_physical_location) RETURNING id INTO v_id;
 RETURN v_id;
END;
$$;

CREATE FUNCTION public.menupro_invite(p_business_id uuid,p_email text,p_role text DEFAULT 'editor') RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_id uuid;
BEGIN
 PERFORM public.menupro_require_owner(p_business_id);
 IF p_role NOT IN ('manager','editor') OR length(p_email)>254 OR p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
   RAISE EXCEPTION 'Correo o rol inválido.' USING ERRCODE='P0001'; END IF;
 PERFORM 1 FROM public.menupro_businesses WHERE id=p_business_id FOR UPDATE;
 IF (SELECT count(*) FROM public.menupro_invitations WHERE business_id=p_business_id AND created_at>now()-interval '1 hour')>=10 THEN
   RAISE EXCEPTION 'Demasiadas invitaciones. Inténtalo más tarde.' USING ERRCODE='P0001'; END IF;
 UPDATE public.menupro_invitations SET revoked_at=now() WHERE business_id=p_business_id AND email=lower(trim(p_email)) AND accepted_at IS NULL AND revoked_at IS NULL;
 INSERT INTO public.menupro_invitations(business_id,email,role,invited_by)
 VALUES(p_business_id,lower(trim(p_email)),p_role,auth.uid()) RETURNING id INTO v_id;
 INSERT INTO public.menupro_audit_events(business_id,actor_id,event,details) VALUES(p_business_id,auth.uid(),'invitation_created',jsonb_build_object('id',v_id,'role',p_role));
 RETURN v_id;
END;
$$;
CREATE FUNCTION public.menupro_accept_invitation(p_invitation_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_i public.menupro_invitations; v_email text;
BEGIN
 SELECT lower(email) INTO v_email FROM auth.users WHERE id=auth.uid() AND email_verified;
 SELECT * INTO v_i FROM public.menupro_invitations WHERE id=p_invitation_id AND email=v_email FOR UPDATE;
 IF v_i.id IS NULL OR v_i.accepted_at IS NOT NULL OR v_i.revoked_at IS NOT NULL OR v_i.expires_at<=now() THEN
   RAISE EXCEPTION 'La invitación no está disponible para esta cuenta.' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.menupro_businesses WHERE id=v_i.business_id FOR UPDATE;
 IF v_i.role='owner' THEN
   UPDATE public.menupro_businesses SET owner_id=auth.uid() WHERE id=v_i.business_id AND owner_id IS NULL;
   IF NOT FOUND THEN RAISE EXCEPTION 'El negocio ya tiene propietario.' USING ERRCODE='P0001'; END IF;
 END IF;
 INSERT INTO public.menupro_memberships(business_id,user_id,role) VALUES(v_i.business_id,auth.uid(),v_i.role)
 ON CONFLICT (business_id,user_id) DO NOTHING;
 UPDATE public.menupro_invitations SET accepted_at=now() WHERE id=v_i.id;
 INSERT INTO public.menupro_audit_events(business_id,actor_id,event) VALUES(v_i.business_id,auth.uid(),'invitation_accepted');
 RETURN v_i.business_id;
END;
$$;
CREATE FUNCTION public.menupro_manage_member(p_business_id uuid,p_user_id uuid,p_action text,p_role text DEFAULT 'editor') RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
 PERFORM public.menupro_require_owner(p_business_id);
 PERFORM 1 FROM public.menupro_businesses WHERE id=p_business_id FOR UPDATE;
 IF p_user_id=auth.uid() OR NOT EXISTS(SELECT 1 FROM public.menupro_memberships WHERE business_id=p_business_id AND user_id=p_user_id) THEN
   RAISE EXCEPTION 'Selecciona otro integrante del negocio.' USING ERRCODE='P0001'; END IF;
 IF p_action='transfer' THEN
   UPDATE public.menupro_memberships SET role='manager' WHERE business_id=p_business_id AND user_id=auth.uid();
   UPDATE public.menupro_memberships SET role='owner' WHERE business_id=p_business_id AND user_id=p_user_id;
   UPDATE public.menupro_businesses SET owner_id=p_user_id WHERE id=p_business_id;
 ELSIF p_action='remove' THEN DELETE FROM public.menupro_memberships WHERE business_id=p_business_id AND user_id=p_user_id;
 ELSIF p_action='role' AND p_role IN ('manager','editor') THEN UPDATE public.menupro_memberships SET role=p_role WHERE business_id=p_business_id AND user_id=p_user_id;
 ELSE RAISE EXCEPTION 'Operación inválida.' USING ERRCODE='P0001'; END IF;
 INSERT INTO public.menupro_audit_events(business_id,actor_id,event,details) VALUES(p_business_id,auth.uid(),'member_'||p_action,jsonb_build_object('user_id',p_user_id,'role',p_role));
END;
$$;
CREATE FUNCTION public.menupro_team(p_business_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
 IF public.menupro_business_role(p_business_id) IS NULL THEN RAISE EXCEPTION 'No tienes permiso.' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('members',(SELECT jsonb_agg(jsonb_build_object('user_id',m.user_id,'email',u.email,'role',m.role))
   FROM public.menupro_memberships m JOIN auth.users u ON u.id=m.user_id WHERE m.business_id=p_business_id),
   'invitations',CASE WHEN public.menupro_business_role(p_business_id)='owner' THEN coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'email',email,'role',role,'expires_at',expires_at))
   FROM public.menupro_invitations WHERE business_id=p_business_id AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now()),'[]') ELSE '[]'::jsonb END);
END;
$$;

CREATE FUNCTION public.menupro_start_trial(p_business_id uuid,p_restaurant_id uuid,p_name text,p_phone text,p_address text,p_city text,
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
 IF v_review THEN
   UPDATE public.menupro_subscriptions SET status='review',updated_at=now() WHERE business_id=p_business_id;
   RETURN jsonb_build_object('status','review','message','Necesitamos verificar los datos del local antes de activar la demo.');
 END IF;
 UPDATE public.menupro_subscriptions SET status='trial',trial_started_at=now(),trial_ends_at=now()+interval '15 days',updated_at=now() WHERE business_id=p_business_id;
 IF NOT EXISTS(SELECT 1 FROM public.menupro_menus WHERE restaurant_id=p_restaurant_id) THEN
   INSERT INTO public.menupro_menus(restaurant_id,name,slug,description) VALUES(p_restaurant_id,'Carta de ejemplo','carta-de-ejemplo','Contenido de ejemplo. Reemplaza estos platos y precios antes de publicar.') RETURNING id INTO v_menu;
   INSERT INTO public.menupro_menu_sections(menu_id,name,description) VALUES(v_menu,'Platos de ejemplo','Edita o elimina esta sección de muestra.') RETURNING id INTO v_section;
   INSERT INTO public.menupro_menu_items(section_id,name,description,price) VALUES(v_section,'Plato de ejemplo','Reemplaza este ejemplo por un plato de tu restaurante.',0);
 END IF;
 INSERT INTO public.menupro_audit_events(business_id,actor_id,event,details) VALUES(p_business_id,auth.uid(),'trial_started',jsonb_build_object('terms_version','2026-10-31'));
 INSERT INTO public.menupro_notifications(business_id,event_key,subject,message) VALUES(p_business_id,'trial_started','Tu demo de 15 días comenzó','Edita la carta de ejemplo y publica tu QR. No se realizará ningún cobro sin tu autorización.');
 RETURN jsonb_build_object('status','trial','ends_at',now()+interval '15 days');
END;
$$;

-- Explicit privileges and policies: members can read; only entitled businesses write.
ALTER TABLE public.menupro_businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menupro_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menupro_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menupro_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menupro_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menupro_trial_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menupro_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menupro_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.menupro_businesses,public.menupro_memberships,public.menupro_invitations,public.menupro_plans,
 public.menupro_subscriptions,public.menupro_trial_claims,public.menupro_audit_events,public.menupro_notifications FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.menupro_businesses,public.menupro_memberships,public.menupro_subscriptions,public.menupro_notifications TO authenticated;
GRANT SELECT ON public.menupro_plans TO anon,authenticated;
CREATE POLICY menupro_businesses_read ON public.menupro_businesses FOR SELECT TO authenticated USING(public.menupro_business_role(id) IS NOT NULL OR public.menupro_is_admin());
CREATE POLICY menupro_memberships_read ON public.menupro_memberships FOR SELECT TO authenticated USING(public.menupro_business_role(business_id) IS NOT NULL);
CREATE POLICY menupro_subscriptions_read ON public.menupro_subscriptions FOR SELECT TO authenticated USING(public.menupro_business_role(business_id) IS NOT NULL OR public.menupro_is_admin());
CREATE POLICY menupro_notifications_read ON public.menupro_notifications FOR SELECT TO authenticated USING(public.menupro_business_role(business_id) IS NOT NULL);
CREATE POLICY menupro_plans_read ON public.menupro_plans FOR SELECT TO anon,authenticated USING(true);

DROP POLICY menupro_restaurants_owner ON public.menupro_restaurants;
DROP POLICY menupro_menus_owner ON public.menupro_menus;
DROP POLICY menupro_sections_owner ON public.menupro_menu_sections;
DROP POLICY menupro_items_owner ON public.menupro_menu_items;
REVOKE ALL ON public.menupro_restaurants FROM anon,authenticated;
GRANT SELECT ON public.menupro_restaurants TO authenticated;
GRANT UPDATE(name,phone,address,city,unit,no_physical_location,theme) ON public.menupro_restaurants TO authenticated;
CREATE POLICY menupro_restaurants_read ON public.menupro_restaurants FOR SELECT TO authenticated USING(public.menupro_business_role(business_id) IS NOT NULL);
CREATE POLICY menupro_restaurants_edit ON public.menupro_restaurants FOR UPDATE TO authenticated
 USING(public.menupro_business_role(business_id) IN ('owner','manager') AND public.menupro_can_edit_restaurant(id))
 WITH CHECK(public.menupro_business_role(business_id) IN ('owner','manager') AND public.menupro_can_edit_restaurant(id));
CREATE POLICY menupro_menus_read ON public.menupro_menus FOR SELECT TO authenticated USING(public.menupro_business_role(public.menupro_menu_business(id)) IS NOT NULL);
CREATE POLICY menupro_menus_write ON public.menupro_menus FOR ALL TO authenticated
 USING(public.menupro_can_edit_restaurant(restaurant_id)) WITH CHECK(public.menupro_can_edit_restaurant(restaurant_id));
CREATE POLICY menupro_sections_read ON public.menupro_menu_sections FOR SELECT TO authenticated USING(public.menupro_business_role(public.menupro_menu_business(menu_id)) IS NOT NULL);
CREATE POLICY menupro_sections_write ON public.menupro_menu_sections FOR ALL TO authenticated
 USING(EXISTS(SELECT 1 FROM public.menupro_menus m WHERE m.id=menu_id AND public.menupro_can_edit_restaurant(m.restaurant_id)))
 WITH CHECK(EXISTS(SELECT 1 FROM public.menupro_menus m WHERE m.id=menu_id AND public.menupro_can_edit_restaurant(m.restaurant_id)));
CREATE POLICY menupro_items_read ON public.menupro_menu_items FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.menupro_menu_sections s WHERE s.id=section_id));
CREATE POLICY menupro_items_write ON public.menupro_menu_items FOR ALL TO authenticated
 USING(EXISTS(SELECT 1 FROM public.menupro_menu_sections s JOIN public.menupro_menus m ON m.id=s.menu_id WHERE s.id=section_id AND public.menupro_can_edit_restaurant(m.restaurant_id)))
 WITH CHECK(EXISTS(SELECT 1 FROM public.menupro_menu_sections s JOIN public.menupro_menus m ON m.id=s.menu_id WHERE s.id=section_id AND public.menupro_can_edit_restaurant(m.restaurant_id)));

CREATE FUNCTION public.menupro_track_menu_saved() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
 -- Inserts of the sample content do not qualify for a welcome discount.
 IF auth.uid() IS NOT NULL THEN
   UPDATE public.menupro_subscriptions SET first_menu_saved_at=coalesce(first_menu_saved_at,now())
    WHERE business_id=public.menupro_menu_business(NEW.id) AND trial_started_at IS NOT NULL;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER menupro_menu_saved AFTER UPDATE ON public.menupro_menus FOR EACH ROW EXECUTE FUNCTION public.menupro_track_menu_saved();

-- The old public projection remains private and is wrapped with a time-based
-- entitlement check. Expiry works even when a scheduled worker has not run.
ALTER FUNCTION public.menupro_public_menu(text,text) RENAME TO menupro_public_menu_content;
REVOKE ALL ON FUNCTION public.menupro_public_menu_content(text,text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.menupro_public_menu(p_restaurant_slug text,p_menu_slug text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
 SELECT CASE WHEN r.archived_at IS NOT NULL OR NOT public.menupro_has_access(r.business_id)
 THEN jsonb_build_object('unavailable',true) ELSE public.menupro_public_menu_content(p_restaurant_slug,p_menu_slug) END
 FROM public.menupro_restaurants r JOIN public.menupro_menus m ON m.restaurant_id=r.id
 WHERE r.slug=p_restaurant_slug AND m.slug=p_menu_slug AND r.active AND m.is_published AND m.active AND m.visible;
$$;
REVOKE ALL ON FUNCTION public.menupro_public_menu(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.menupro_public_menu(text,text) TO anon,authenticated;

-- Revoke PostgreSQL's default PUBLIC EXECUTE on all app-owned helpers/RPCs.
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname LIKE 'menupro_%' AND p.proname NOT IN ('menupro_public_menu','menupro_public_menu_content') LOOP
   EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',f.signature);
   EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.signature);
 END LOOP;
END $$;
