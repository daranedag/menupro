-- The verified platform role has its own session, without provisioning a tenant.
CREATE FUNCTION public.menupro_panel_session(p_business_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF public.menupro_is_admin() THEN
  RETURN jsonb_build_object('is_admin',true,'business_id',NULL,'business_role',NULL,
    'businesses','[]'::jsonb,'restaurants','[]'::jsonb,'subscription',NULL,'invitations','[]'::jsonb);
 END IF;
 RETURN public.menupro_session(p_business_id);
END; $$;
REVOKE ALL ON FUNCTION public.menupro_panel_session(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.menupro_panel_session(uuid) TO authenticated;

CREATE INDEX menupro_audit_created_idx ON public.menupro_audit_events(created_at DESC,id DESC);

CREATE FUNCTION public.menupro_admin_records(p_kind text,p_offset integer DEFAULT 0,p_from date DEFAULT NULL,
 p_to date DEFAULT NULL,p_actor text DEFAULT '',p_event text DEFAULT '',p_status text DEFAULT 'all') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_rows jsonb;
BEGIN
 IF NOT public.menupro_is_admin() THEN RAISE EXCEPTION 'No tienes permiso.' USING ERRCODE='42501'; END IF;
 IF p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 1000000 THEN RAISE EXCEPTION 'Página inválida.'; END IF;
 IF p_kind='businesses' THEN
  SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC,t.id DESC) INTO v_rows FROM (
   SELECT b.id,b.name,b.created_at,u.email AS owner_email,s.plan_id,s.status,
    public.menupro_has_access(b.id) AS has_access
   FROM public.menupro_businesses b LEFT JOIN auth.users u ON u.id=b.owner_id
   LEFT JOIN public.menupro_subscriptions s ON s.business_id=b.id
   ORDER BY b.created_at DESC,b.id DESC LIMIT 51 OFFSET p_offset
  ) t;
 ELSIF p_kind='logs' THEN
  SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC,t.id DESC) INTO v_rows FROM (
   SELECT e.*,u.email AS actor_email,p.name AS actor_name,b.name AS business_name
   FROM public.menupro_audit_events e LEFT JOIN auth.users u ON u.id=e.actor_id
   LEFT JOIN public.menupro_profiles p ON p.id=e.actor_id
   LEFT JOIN public.menupro_businesses b ON b.id=e.business_id
   WHERE (p_from IS NULL OR e.created_at >= (p_from::timestamp AT TIME ZONE 'America/Santiago'))
    AND (p_to IS NULL OR e.created_at < ((p_to+1)::timestamp AT TIME ZONE 'America/Santiago'))
    AND (coalesce(p_actor,'')='' OR position(lower(p_actor) in lower(concat_ws(' ',u.email,p.name,e.actor_id)))>0)
    AND (coalesce(p_event,'')='' OR position(lower(p_event) in lower(e.event))>0)
   ORDER BY e.created_at DESC,e.id DESC LIMIT 51 OFFSET p_offset
  ) t;
 ELSIF p_kind='transfers' THEN
  SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC,t.id DESC) INTO v_rows FROM (
   SELECT p.provider_payment_id AS id,substr(p.provider_payment_id,6) AS reference,p.created_at,p.approved_at,
    p.amount,p.currency,p.status,p.period_start,p.period_end,b.name AS business_name,r.plan_id,r.cycle,
    u.email AS actor_email,a.details->>'reason' AS reason
   FROM public.menupro_payment_events p JOIN public.menupro_businesses b ON b.id=p.business_id
   JOIN public.menupro_checkout_requests r ON r.id=p.request_id
   LEFT JOIN auth.users u ON u.id=r.created_by
   LEFT JOIN LATERAL (
    SELECT e.details FROM public.menupro_audit_events e
    WHERE e.business_id=b.id AND e.event='bank_payment_confirmed' AND e.details->>'reference'=substr(p.provider_payment_id,6)
    ORDER BY e.created_at DESC LIMIT 1
   ) a ON true
   WHERE p.provider_payment_id LIKE 'bank:%'
   ORDER BY p.created_at DESC,p.provider_payment_id DESC LIMIT 51 OFFSET p_offset
  ) t;
 ELSIF p_kind='claims' THEN
  SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC,t.id DESC) INTO v_rows FROM (
   SELECT c.id,c.status,c.created_at,c.reviewed_at,c.reason,b.name,u.email AS actor_email
   FROM public.menupro_trial_claims c LEFT JOIN public.menupro_businesses b ON b.id=c.business_id
   LEFT JOIN auth.users u ON u.id=c.actor_id
   WHERE p_status='all' OR c.status=p_status
   ORDER BY c.created_at DESC,c.id DESC LIMIT 51 OFFSET p_offset
  ) t;
 ELSE RAISE EXCEPTION 'Listado inválido.'; END IF;
 RETURN coalesce(v_rows,'[]');
END; $$;

CREATE FUNCTION public.menupro_admin_business_details(p_business_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_details jsonb;
BEGIN
 IF NOT public.menupro_is_admin() THEN RAISE EXCEPTION 'No tienes permiso.' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object(
  'business',to_jsonb(b)||jsonb_build_object('owner_email',u.email,'owner_name',op.name,'owner_verified',u.email_verified),
  'subscription',to_jsonb(s),
  'billing',to_jsonb(f),
  'restaurants',coalesce((SELECT jsonb_agg(to_jsonb(r)||jsonb_build_object('menu_count',
    (SELECT count(*) FROM public.menupro_menus m WHERE m.restaurant_id=r.id)) ORDER BY r.created_at)
    FROM public.menupro_restaurants r WHERE r.business_id=b.id),'[]'),
  'members',coalesce((SELECT jsonb_agg(to_jsonb(m)||jsonb_build_object('email',mu.email,'name',mp.name) ORDER BY m.created_at)
    FROM public.menupro_memberships m JOIN auth.users mu ON mu.id=m.user_id
    LEFT JOIN public.menupro_profiles mp ON mp.id=m.user_id WHERE m.business_id=b.id),'[]'),
  'invitations',coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.created_at DESC)
    FROM public.menupro_invitations i WHERE i.business_id=b.id),'[]'),
  'demo_requests',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.created_at DESC) FROM (
    SELECT id,status,created_at,reviewed_at,reviewed_by,reason FROM public.menupro_trial_claims
    WHERE business_id=b.id ORDER BY created_at DESC LIMIT 10
  ) c),'[]'),
  'recent_payments',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.created_at DESC) FROM (
    SELECT provider_payment_id AS id,status,amount,currency,refunded_amount,period_start,period_end,approved_at,created_at
    FROM public.menupro_payment_events WHERE business_id=b.id ORDER BY created_at DESC LIMIT 10
  ) p),'[]'))
 INTO v_details FROM public.menupro_businesses b LEFT JOIN auth.users u ON u.id=b.owner_id
 LEFT JOIN public.menupro_profiles op ON op.id=b.owner_id
 LEFT JOIN public.menupro_subscriptions s ON s.business_id=b.id
 LEFT JOIN public.menupro_billing_profiles f ON f.business_id=b.id
 WHERE b.id=p_business_id;
 RETURN v_details;
END; $$;

CREATE FUNCTION public.menupro_admin_business_choices() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NOT public.menupro_is_admin() THEN RAISE EXCEPTION 'No tienes permiso.' USING ERRCODE='42501'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,'owner_email',u.email) ORDER BY lower(b.name),b.id)
  FROM public.menupro_businesses b LEFT JOIN auth.users u ON u.id=b.owner_id),'[]');
END; $$;
REVOKE ALL ON FUNCTION public.menupro_admin_records(text,integer,date,date,text,text,text),
 public.menupro_admin_business_details(uuid),public.menupro_admin_business_choices() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.menupro_admin_records(text,integer,date,date,text,text,text),
 public.menupro_admin_business_details(uuid),public.menupro_admin_business_choices() TO authenticated;
