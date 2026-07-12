
-- 1) Provider
CREATE TABLE public.sso_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  provider_type text NOT NULL CHECK (provider_type IN ('saml','oidc','scim')),
  issuer_url text,
  metadata_url text,
  client_id text,
  client_secret_ref text,
  default_role_id uuid REFERENCES public.roles(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  jit_provisioning boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sso_providers TO authenticated;
GRANT ALL ON public.sso_providers TO service_role;
ALTER TABLE public.sso_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SA manage sso_providers" ON public.sso_providers
  FOR ALL USING (public.has_role('Super Admin')) WITH CHECK (public.has_role('Super Admin'));

-- 2) Group Mappings
CREATE TABLE public.sso_group_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.sso_providers(id) ON DELETE CASCADE,
  external_group text NOT NULL,
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, external_group, role_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sso_group_mappings TO authenticated;
GRANT ALL ON public.sso_group_mappings TO service_role;
ALTER TABLE public.sso_group_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SA manage sso_group_mappings" ON public.sso_group_mappings
  FOR ALL USING (public.has_role('Super Admin')) WITH CHECK (public.has_role('Super Admin'));

-- 3) SCIM Tokens
CREATE TABLE public.scim_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.sso_providers(id) ON DELETE CASCADE,
  name text NOT NULL,
  token_hash text NOT NULL,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scim_tokens TO authenticated;
GRANT ALL ON public.scim_tokens TO service_role;
ALTER TABLE public.scim_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SA manage scim_tokens" ON public.scim_tokens
  FOR ALL USING (public.has_role('Super Admin')) WITH CHECK (public.has_role('Super Admin'));

CREATE OR REPLACE FUNCTION public.tg_sso_provider_updated()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_sso_provider_updated ON public.sso_providers;
CREATE TRIGGER trg_sso_provider_updated BEFORE UPDATE ON public.sso_providers
  FOR EACH ROW EXECUTE FUNCTION public.tg_sso_provider_updated();
