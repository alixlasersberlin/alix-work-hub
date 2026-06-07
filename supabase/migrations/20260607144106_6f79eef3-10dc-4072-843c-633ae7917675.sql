
-- Phase 15: Multi-Mandantenfähigkeit (additiv, keine Änderung bestehender Tabellen)

CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  country text,
  currency text DEFAULT 'EUR',
  flag_emoji text,
  zoho_source_system text UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenants readable by auth" ON public.tenants
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "tenants manage super admin" ON public.tenants
  FOR ALL TO authenticated
  USING (public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Super Admin'));

CREATE TABLE IF NOT EXISTS public.user_tenant_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role_scope text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_tenant_access TO authenticated;
GRANT ALL ON public.user_tenant_access TO service_role;
ALTER TABLE public.user_tenant_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uta self read" ON public.user_tenant_access
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "uta admin manage" ON public.user_tenant_access
  FOR ALL TO authenticated
  USING (public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Super Admin'));

-- Helper functions
CREATE OR REPLACE FUNCTION public.tenant_id_for_source(_source text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.tenants WHERE zoho_source_system = _source LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_has_tenant(_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.user_tenant_access
    WHERE user_id = auth.uid() AND tenant_id = _tenant_id
  );
$$;

-- updated_at trigger reuse
DROP TRIGGER IF EXISTS trg_tenants_updated_at ON public.tenants;
CREATE TRIGGER trg_tenants_updated_at BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed Mandanten (idempotent)
INSERT INTO public.tenants (code, name, country, currency, flag_emoji, zoho_source_system, sort_order) VALUES
  ('DE',      'Alix Germany', 'DE', 'EUR', '🇩🇪', 'zoho_eu_1', 10),
  ('AT',      'Alix Austria', 'AT', 'EUR', '🇦🇹', 'zoho_eu_2', 20),
  ('US',      'Alix USA',     'US', 'USD', '🇺🇸', NULL,        30),
  ('MED',     'Alix Medical', 'DE', 'EUR', '⚕️', NULL,         40),
  ('DXB',     'Alix Dubai',   'AE', 'AED', '🇦🇪', NULL,        50)
ON CONFLICT (code) DO NOTHING;
