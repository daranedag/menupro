-- Existing item updates use explicit column grants. The image guard and RLS
-- still validate paid entitlement and matching business for every assignment.
GRANT UPDATE(image_asset_id) ON public.menupro_menu_items TO authenticated;
