-- Only Local mensual is sold at launch. Existing paid contracts keep renewing.
CREATE TABLE public.menupro_commercial_settings (
 id boolean PRIMARY KEY DEFAULT true CHECK(id),
 grupo_enabled boolean NOT NULL DEFAULT false,
 annual_enabled boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.menupro_commercial_settings(id) VALUES(true);
ALTER TABLE public.menupro_commercial_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.menupro_commercial_settings FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.menupro_commercial_settings TO anon,authenticated;
CREATE POLICY menupro_commercial_read ON public.menupro_commercial_settings FOR SELECT TO anon,authenticated USING(true);

CREATE FUNCTION public.menupro_admin_set_commercial(p_grupo_enabled boolean,p_annual_enabled boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_result jsonb;
BEGIN
 IF NOT public.menupro_is_admin() THEN RAISE EXCEPTION 'No tienes permiso.' USING ERRCODE='42501'; END IF;
 IF p_grupo_enabled IS NULL OR p_annual_enabled IS NULL THEN RAISE EXCEPTION 'Indica ambas opciones.'; END IF;
 UPDATE public.menupro_commercial_settings SET grupo_enabled=p_grupo_enabled,annual_enabled=p_annual_enabled,updated_at=now() WHERE id RETURNING to_jsonb(menupro_commercial_settings.*) INTO v_result;
 INSERT INTO public.menupro_audit_events(actor_id,event,details) VALUES(auth.uid(),'commercial_settings_changed',v_result);
 RETURN v_result;
END; $$;
REVOKE ALL ON FUNCTION public.menupro_admin_set_commercial(boolean,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.menupro_admin_set_commercial(boolean,boolean) TO authenticated;

CREATE FUNCTION public.menupro_require_plan_available(p_plan_id text,p_cycle text) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v public.menupro_commercial_settings;
BEGIN
 SELECT * INTO v FROM public.menupro_commercial_settings WHERE id;
 IF p_plan_id='grupo' AND NOT coalesce(v.grupo_enabled,false) THEN RAISE EXCEPTION 'Grupo estará disponible próximamente.' USING ERRCODE='P0001'; END IF;
 IF p_cycle='annual' AND NOT coalesce(v.annual_enabled,false) THEN RAISE EXCEPTION 'La modalidad anual estará disponible próximamente.' USING ERRCODE='P0001'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.menupro_require_plan_available(text,text) FROM PUBLIC,anon,authenticated;

ALTER FUNCTION public.menupro_quote(uuid,text,text,text) RENAME TO menupro_quote_before_launch;
REVOKE ALL ON FUNCTION public.menupro_quote_before_launch(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.menupro_quote(p_business_id uuid,p_plan_id text,p_cycle text,p_purpose text DEFAULT 'subscription') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 PERFORM public.menupro_require_owner(p_business_id);
 PERFORM public.menupro_require_plan_available(p_plan_id,p_cycle);
 RETURN public.menupro_quote_before_launch(p_business_id,p_plan_id,p_cycle,p_purpose);
END; $$;
REVOKE ALL ON FUNCTION public.menupro_quote(uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.menupro_quote(uuid,text,text,text) TO authenticated;

-- Covers every new checkout, including administrative bank payments and direct
-- RPC callers. Reconciliation never uses this insert gate to reject paid periods.
CREATE FUNCTION public.menupro_guard_new_checkout_plan() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 PERFORM public.menupro_require_plan_available(NEW.plan_id,NEW.cycle);
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.menupro_guard_new_checkout_plan() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER menupro_checkout_launch_guard BEFORE INSERT ON public.menupro_checkout_requests
FOR EACH ROW EXECUTE FUNCTION public.menupro_guard_new_checkout_plan();
