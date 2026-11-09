-- Platform compatibility for MenuPro's existing, versioned business migrations.
-- Only the BFF holds the owner connection. Every application query SET LOCALs
-- a restricted role and a verified identity, inside its own transaction.
DO $$ BEGIN
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='menupro_anon') THEN CREATE ROLE menupro_anon NOLOGIN NOSUPERUSER NOBYPASSRLS; END IF;
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='menupro_authenticated') THEN CREATE ROLE menupro_authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS; END IF;
 EXECUTE format('GRANT menupro_anon, menupro_authenticated TO %I', current_user);
END $$;
GRANT USAGE ON SCHEMA public TO menupro_anon, menupro_authenticated;

CREATE TABLE public.menupro_users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 provider_id text NOT NULL UNIQUE,
 email text NOT NULL,
 email_verified boolean NOT NULL DEFAULT false,
 profile jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.menupro_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.menupro_users FROM PUBLIC,menupro_anon,menupro_authenticated;

CREATE FUNCTION public.menupro_auth_uid() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('menupro.user_id',true),'')::uuid $$;
REVOKE ALL ON FUNCTION public.menupro_auth_uid() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.menupro_auth_uid() TO menupro_anon,menupro_authenticated;

-- PDFs are small (2 MB max), private and durable in Neon. The existing fiscal
-- policies below continue to govern reads, uploads and orphan-file cleanup.
CREATE TABLE public.menupro_storage_objects (
 bucket text NOT NULL CHECK(bucket='menupro_fiscal'),
 key text NOT NULL,
 size integer NOT NULL CHECK(size BETWEEN 6 AND 2097152),
 mime_type text NOT NULL CHECK(mime_type='application/pdf'),
 uploaded_by text NOT NULL DEFAULT public.menupro_auth_uid()::text,
 content bytea NOT NULL CHECK(octet_length(content)=size AND substring(content FROM 1 FOR 5)=convert_to('%PDF-','UTF8')),
 uploaded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(bucket,key)
);
ALTER TABLE public.menupro_storage_objects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.menupro_storage_objects FROM PUBLIC,menupro_anon,menupro_authenticated;
GRANT SELECT,INSERT,DELETE ON public.menupro_storage_objects TO menupro_authenticated;
CREATE POLICY menupro_storage_insert ON public.menupro_storage_objects FOR INSERT TO menupro_authenticated
 WITH CHECK(uploaded_by=public.menupro_auth_uid()::text);
CREATE POLICY menupro_storage_delete ON public.menupro_storage_objects FOR DELETE TO menupro_authenticated
 USING(uploaded_by=public.menupro_auth_uid()::text);
