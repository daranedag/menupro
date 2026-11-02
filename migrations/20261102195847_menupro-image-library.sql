-- Optional connections. A current paid period is required; courtesy and grace do
-- not grant this capability. Cancellation of renewal keeps the paid period.
CREATE FUNCTION public.menupro_has_paid_images(p_business_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
 SELECT public.menupro_business_role(p_business_id) IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.menupro_subscriptions s WHERE s.business_id=p_business_id
   AND s.status IN ('active','cancelled') AND s.current_period_end>now()
   AND EXISTS(SELECT 1 FROM public.menupro_payment_events e WHERE e.business_id=s.business_id
    AND e.status='approved' AND e.amount>e.refunded_amount AND e.period_end>now()
    AND e.approved_at IS NOT NULL));
$$;

CREATE TABLE public.menupro_image_sources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL UNIQUE REFERENCES public.menupro_businesses(id) ON DELETE CASCADE,
 provider text NOT NULL CHECK(provider IN ('imagekit','public')),
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100),
 base_url text NOT NULL CHECK(length(base_url)<=2048 AND base_url ~ '^https://[^/@?#[:space:]]+\.[^/@?#[:space:]]+(/[^?#[:space:]]*)?$'),
 folder text NOT NULL DEFAULT '/' CHECK(length(folder)<=500 AND folder LIKE '/%'),
 encrypted_key text CHECK(length(encrypted_key)<=2048),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT menupro_image_source_key_check CHECK((provider='public' AND encrypted_key IS NULL) OR (provider='imagekit' AND encrypted_key LIKE 'v1.%'))
);
CREATE TABLE public.menupro_image_assets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.menupro_businesses(id) ON DELETE CASCADE,
 source_id uuid REFERENCES public.menupro_image_sources(id) ON DELETE SET NULL,
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 255),
 original_url text NOT NULL CHECK(length(original_url)<=2048),
 url text NOT NULL CHECK(length(url)<=2048),
 storage_provider text NOT NULL DEFAULT 'external' CHECK(storage_provider IN ('external','menupro')),
 storage_key text,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT menupro_image_assets_original_unique UNIQUE(business_id,original_url),
 CONSTRAINT menupro_image_assets_storage_check CHECK((storage_provider='external' AND storage_key IS NULL) OR (storage_provider='menupro' AND storage_key IS NOT NULL))
);
CREATE INDEX menupro_image_assets_source_idx ON public.menupro_image_assets(source_id);
ALTER TABLE public.menupro_menu_items ADD COLUMN image_asset_id uuid REFERENCES public.menupro_image_assets(id) ON DELETE RESTRICT;
CREATE INDEX menupro_items_image_asset_idx ON public.menupro_menu_items(image_asset_id) WHERE image_asset_id IS NOT NULL;

ALTER TABLE public.menupro_image_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menupro_image_assets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.menupro_image_sources,public.menupro_image_assets FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,DELETE ON public.menupro_image_sources TO authenticated;
GRANT UPDATE(provider,name,base_url,folder,encrypted_key) ON public.menupro_image_sources TO authenticated;
GRANT SELECT ON public.menupro_image_assets TO authenticated;
CREATE POLICY menupro_image_sources_read ON public.menupro_image_sources FOR SELECT TO authenticated USING(public.menupro_business_role(business_id) IS NOT NULL);
CREATE POLICY menupro_image_sources_insert ON public.menupro_image_sources FOR INSERT TO authenticated WITH CHECK(public.menupro_business_role(business_id) IN ('owner','manager') AND public.menupro_has_paid_images(business_id));
CREATE POLICY menupro_image_sources_update ON public.menupro_image_sources FOR UPDATE TO authenticated USING(public.menupro_business_role(business_id) IN ('owner','manager') AND public.menupro_has_paid_images(business_id)) WITH CHECK(public.menupro_business_role(business_id) IN ('owner','manager') AND public.menupro_has_paid_images(business_id));
CREATE POLICY menupro_image_sources_delete ON public.menupro_image_sources FOR DELETE TO authenticated USING(public.menupro_business_role(business_id) IN ('owner','manager'));
CREATE POLICY menupro_image_assets_read ON public.menupro_image_assets FOR SELECT TO authenticated USING(public.menupro_business_role(business_id) IS NOT NULL);

CREATE FUNCTION public.menupro_register_image(p_source_id uuid,p_url text,p_name text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_source public.menupro_image_sources; v_asset public.menupro_image_assets;
BEGIN
 SELECT * INTO v_source FROM public.menupro_image_sources WHERE id=p_source_id FOR SHARE;
 IF v_source.id IS NULL OR NOT coalesce(public.menupro_has_paid_images(v_source.business_id),false) THEN
  RAISE EXCEPTION 'Se requiere una suscripción pagada vigente.' USING ERRCODE='42501'; END IF;
 IF length(trim(p_name)) NOT BETWEEN 1 AND 255 OR length(p_url)>2048 OR
  left(p_url,length(rtrim(v_source.base_url,'/')||'/'))<>rtrim(v_source.base_url,'/')||'/' OR
  p_url ~ '[?#[:space:]]' OR p_url ~ '/\.\.?(/|$)' OR p_url ~* '%2e|%2f|%5c' THEN
  RAISE EXCEPTION 'La imagen debe pertenecer al servidor conectado.' USING ERRCODE='P0001'; END IF;
 INSERT INTO public.menupro_image_assets(business_id,source_id,name,original_url,url)
 VALUES(v_source.business_id,v_source.id,trim(p_name),p_url,p_url)
 ON CONFLICT(business_id,original_url) DO UPDATE SET source_id=excluded.source_id
 RETURNING * INTO v_asset;
 RETURN jsonb_build_object('id',v_asset.id,'url',v_asset.url,'name',v_asset.name);
END;
$$;

CREATE FUNCTION public.menupro_guard_dish_image() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_business uuid; v_asset public.menupro_image_assets;
BEGIN
 IF TG_OP='UPDATE' AND NEW.image_asset_id IS NOT DISTINCT FROM OLD.image_asset_id AND NEW.image_url IS NOT DISTINCT FROM OLD.image_url AND NEW.section_id=OLD.section_id THEN RETURN NEW; END IF;
 IF NEW.image_asset_id IS NULL THEN RETURN NEW; END IF;
 SELECT public.menupro_menu_business(s.menu_id) INTO v_business FROM public.menupro_menu_sections s WHERE s.id=NEW.section_id;
 SELECT * INTO v_asset FROM public.menupro_image_assets WHERE id=NEW.image_asset_id;
 IF v_asset.id IS NULL OR v_asset.business_id IS DISTINCT FROM v_business OR
   NOT coalesce(public.menupro_has_paid_images(v_business),false) THEN
  RAISE EXCEPTION 'No puedes usar esta imagen en este negocio.' USING ERRCODE='42501'; END IF;
 -- The stored URL is authoritative. It remains usable after disconnecting.
 NEW.image_url:=v_asset.url;
 RETURN NEW;
END;
$$;
CREATE TRIGGER menupro_guard_dish_image BEFORE INSERT OR UPDATE ON public.menupro_menu_items FOR EACH ROW EXECUTE FUNCTION public.menupro_guard_dish_image();
REVOKE ALL ON FUNCTION public.menupro_has_paid_images(uuid),public.menupro_register_image(uuid,text,text),public.menupro_guard_dish_image() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.menupro_has_paid_images(uuid),public.menupro_register_image(uuid,text,text) TO authenticated;
