-- Legacy blanket function grants predate the Neon identity helper. Public
-- calls may evaluate it, but neither runtime role can write the identity map.
GRANT EXECUTE ON FUNCTION public.menupro_auth_uid() TO menupro_anon,menupro_authenticated;
ALTER TABLE public.menupro_schema_migrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.menupro_schema_migrations FROM PUBLIC,menupro_anon,menupro_authenticated;
