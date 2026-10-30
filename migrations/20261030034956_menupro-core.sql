-- New MenuPro objects only. Existing applications on DieGui Dev are untouched.
CREATE TABLE public.menupro_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.menupro_restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 255),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  phone text NOT NULL DEFAULT '', address text NOT NULL DEFAULT '', city text NOT NULL DEFAULT '',
  currency text NOT NULL DEFAULT 'CLP',
  theme jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX menupro_restaurants_owner_idx ON public.menupro_restaurants(owner_id);

CREATE TABLE public.menupro_menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.menupro_restaurants(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 255),
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text NOT NULL DEFAULT '', icon text NOT NULL DEFAULT '🍽️',
  is_published boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true, visible boolean NOT NULL DEFAULT true,
  show_call_to_action boolean NOT NULL DEFAULT true,
  cta_title text, cta_description text, phone_number text, delivery_url text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, slug)
);

CREATE TABLE public.menupro_menu_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id uuid NOT NULL REFERENCES public.menupro_menus(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 255),
  description text NOT NULL DEFAULT '', icon text,
  active boolean NOT NULL DEFAULT true, visible boolean NOT NULL DEFAULT true,
  order_index integer NOT NULL DEFAULT 0 CHECK (order_index >= 0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX menupro_menu_sections_menu_idx ON public.menupro_menu_sections(menu_id, order_index);

CREATE TABLE public.menupro_menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.menupro_menu_sections(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 255),
  description text NOT NULL DEFAULT '', long_description text,
  price numeric(10,2) NOT NULL CHECK (price >= 0),
  discount numeric(5,2) NOT NULL DEFAULT 0 CHECK (discount BETWEEN 0 AND 100),
  image_url text, tags jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(tags) = 'array'),
  calories integer CHECK (calories >= 0), prep_time integer CHECK (prep_time >= 0),
  is_vegetarian boolean NOT NULL DEFAULT false, is_spicy boolean NOT NULL DEFAULT false,
  available boolean NOT NULL DEFAULT true, visible boolean NOT NULL DEFAULT true,
  order_index integer NOT NULL DEFAULT 0 CHECK (order_index >= 0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX menupro_menu_items_section_idx ON public.menupro_menu_items(section_id, order_index);

CREATE FUNCTION public.menupro_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER menupro_restaurants_updated BEFORE UPDATE ON public.menupro_restaurants FOR EACH ROW EXECUTE FUNCTION public.menupro_touch_updated_at();
CREATE TRIGGER menupro_menus_updated BEFORE UPDATE ON public.menupro_menus FOR EACH ROW EXECUTE FUNCTION public.menupro_touch_updated_at();
CREATE TRIGGER menupro_menu_sections_updated BEFORE UPDATE ON public.menupro_menu_sections FOR EACH ROW EXECUTE FUNCTION public.menupro_touch_updated_at();
CREATE TRIGGER menupro_menu_items_updated BEFORE UPDATE ON public.menupro_menu_items FOR EACH ROW EXECUTE FUNCTION public.menupro_touch_updated_at();

ALTER TABLE public.menupro_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menupro_restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menupro_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menupro_menu_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menupro_menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY menupro_profiles_owner ON public.menupro_profiles FOR ALL TO authenticated
  USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));
CREATE POLICY menupro_restaurants_owner ON public.menupro_restaurants FOR ALL TO authenticated
  USING (owner_id = (SELECT auth.uid())) WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY menupro_menus_owner ON public.menupro_menus FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.menupro_restaurants r WHERE r.id = restaurant_id AND r.owner_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.menupro_restaurants r WHERE r.id = restaurant_id AND r.owner_id = (SELECT auth.uid())));
CREATE POLICY menupro_sections_owner ON public.menupro_menu_sections FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.menupro_menus m WHERE m.id = menu_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.menupro_menus m WHERE m.id = menu_id));
CREATE POLICY menupro_items_owner ON public.menupro_menu_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.menupro_menu_sections s WHERE s.id = section_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.menupro_menu_sections s WHERE s.id = section_id));

REVOKE ALL ON public.menupro_profiles, public.menupro_restaurants, public.menupro_menus,
  public.menupro_menu_sections, public.menupro_menu_items FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.menupro_profiles, public.menupro_restaurants, public.menupro_menus,
  public.menupro_menu_sections, public.menupro_menu_items TO authenticated;
GRANT UPDATE (name) ON public.menupro_profiles TO authenticated;
GRANT UPDATE (name, slug, phone, address, city, theme, active) ON public.menupro_restaurants TO authenticated;
GRANT UPDATE (name, description, icon, is_published, active, visible, show_call_to_action, cta_title, cta_description, phone_number, delivery_url)
  ON public.menupro_menus TO authenticated;
GRANT UPDATE (name, description, icon, active, visible, order_index) ON public.menupro_menu_sections TO authenticated;
GRANT UPDATE (name, description, long_description, price, discount, image_url, tags, calories, prep_time, is_vegetarian, is_spicy, available, visible, order_index)
  ON public.menupro_menu_items TO authenticated;

-- This is the only public projection. It omits owner IDs and unpublished content.
CREATE FUNCTION public.menupro_public_menu(p_restaurant_slug text, p_menu_slug text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT jsonb_build_object(
    'restaurant', jsonb_build_object('name', r.name, 'slug', r.slug, 'phone', r.phone, 'address', r.address, 'city', r.city, 'currency', r.currency, 'theme', r.theme),
    'menu', jsonb_build_object('id', m.id, 'name', m.name, 'slug', m.slug, 'description', m.description, 'icon', m.icon,
      'show_call_to_action', m.show_call_to_action, 'cta_title', m.cta_title, 'cta_description', m.cta_description,
      'phone_number', m.phone_number, 'delivery_url', m.delivery_url,
      'sections', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'description', s.description, 'icon', s.icon,
        'order_index', s.order_index, 'active', s.active, 'visible', s.visible,
        'items', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'description', i.description,
          'long_description', i.long_description, 'price', i.price, 'discount', i.discount, 'image_url', i.image_url,
          'tags', i.tags, 'calories', i.calories, 'prep_time', i.prep_time, 'is_vegetarian', i.is_vegetarian,
          'is_spicy', i.is_spicy, 'available', i.available, 'visible', i.visible, 'order_index', i.order_index) ORDER BY i.order_index, i.id)
          FROM public.menupro_menu_items i WHERE i.section_id = s.id AND i.available AND i.visible), '[]'::jsonb)) ORDER BY s.order_index, s.id)
        FROM public.menupro_menu_sections s WHERE s.menu_id = m.id AND s.active AND s.visible), '[]'::jsonb)))
  FROM public.menupro_restaurants r JOIN public.menupro_menus m ON m.restaurant_id = r.id
  WHERE r.slug = p_restaurant_slug AND m.slug = p_menu_slug AND r.active AND m.is_published AND m.active AND m.visible;
$$;
REVOKE ALL ON FUNCTION public.menupro_public_menu(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.menupro_public_menu(text, text) TO anon, authenticated;

CREATE FUNCTION public.menupro_reorder_sections(p_menu_id uuid, p_ids uuid[]) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.menupro_menus WHERE id = p_menu_id)
    OR cardinality(p_ids) <> (SELECT count(*) FROM public.menupro_menu_sections WHERE menu_id = p_menu_id)
    OR cardinality(p_ids) <> (SELECT count(DISTINCT id) FROM unnest(p_ids) AS id)
    OR cardinality(p_ids) <> (SELECT count(*) FROM public.menupro_menu_sections WHERE menu_id = p_menu_id AND id = ANY(p_ids))
  THEN RAISE EXCEPTION 'Invalid section order' USING ERRCODE = '42501'; END IF;
  UPDATE public.menupro_menu_sections s SET order_index = v.position - 1
    FROM unnest(p_ids) WITH ORDINALITY AS v(id, position) WHERE s.id = v.id AND s.menu_id = p_menu_id;
END; $$;
CREATE FUNCTION public.menupro_reorder_items(p_section_id uuid, p_ids uuid[]) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.menupro_menu_sections WHERE id = p_section_id)
    OR cardinality(p_ids) <> (SELECT count(*) FROM public.menupro_menu_items WHERE section_id = p_section_id)
    OR cardinality(p_ids) <> (SELECT count(DISTINCT id) FROM unnest(p_ids) AS id)
    OR cardinality(p_ids) <> (SELECT count(*) FROM public.menupro_menu_items WHERE section_id = p_section_id AND id = ANY(p_ids))
  THEN RAISE EXCEPTION 'Invalid item order' USING ERRCODE = '42501'; END IF;
  UPDATE public.menupro_menu_items i SET order_index = v.position - 1
    FROM unnest(p_ids) WITH ORDINALITY AS v(id, position) WHERE i.id = v.id AND i.section_id = p_section_id;
END; $$;
REVOKE ALL ON FUNCTION public.menupro_reorder_sections(uuid, uuid[]), public.menupro_reorder_items(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.menupro_reorder_sections(uuid, uuid[]), public.menupro_reorder_items(uuid, uuid[]) TO authenticated;
