-- Previously, turning availability off hid the dish. Preserve that choice.
UPDATE public.menupro_menu_items SET visible = false WHERE NOT available AND visible;

-- Visibility controls inclusion; availability is exposed for the unavailable treatment.
-- Keep the entitlement wrapper and its restricted inner-function permissions intact.
CREATE OR REPLACE FUNCTION public.menupro_public_menu_content(p_restaurant_slug text, p_menu_slug text) RETURNS jsonb
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
          FROM public.menupro_menu_items i WHERE i.section_id = s.id AND i.visible), '[]'::jsonb)) ORDER BY s.order_index, s.id)
        FROM public.menupro_menu_sections s WHERE s.menu_id = m.id AND s.active AND s.visible), '[]'::jsonb)))
  FROM public.menupro_restaurants r JOIN public.menupro_menus m ON m.restaurant_id = r.id
  WHERE r.slug = p_restaurant_slug AND m.slug = p_menu_slug AND r.active AND m.is_published AND m.active AND m.visible;
$$;
REVOKE ALL ON FUNCTION public.menupro_public_menu_content(text, text) FROM PUBLIC, anon, authenticated;
