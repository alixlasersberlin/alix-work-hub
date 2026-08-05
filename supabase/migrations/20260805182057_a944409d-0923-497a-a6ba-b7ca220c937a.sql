-- 1) Mandanten-Profilfelder (additiv)
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS address_line1 text,
  ADD COLUMN IF NOT EXISTS address_line2 text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS country_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS vat_id text,
  ADD COLUMN IF NOT EXISTS tax_number text,
  ADD COLUMN IF NOT EXISTS bank_details text,
  ADD COLUMN IF NOT EXISTS accent_color text;

-- 2) Workspaces
CREATE TABLE IF NOT EXISTS public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  icon text NOT NULL DEFAULT 'LayoutDashboard',
  emoji text,
  dashboard_path text,
  sort_order integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspaces_select" ON public.workspaces FOR SELECT TO authenticated USING (true);
CREATE POLICY "workspaces_insert" ON public.workspaces FOR INSERT TO authenticated
  WITH CHECK (public.has_role('Super Admin') OR public.has_role('Admin'));
CREATE POLICY "workspaces_update" ON public.workspaces FOR UPDATE TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin'));
CREATE POLICY "workspaces_delete" ON public.workspaces FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

-- 3) Workspace-Navigation
CREATE TABLE IF NOT EXISTS public.workspace_nav_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  label text NOT NULL,
  path text NOT NULL,
  icon text NOT NULL DEFAULT 'Circle',
  section text,
  roles text[],
  tenant_codes text[],
  sort_order integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_workspace_nav_items_ws ON public.workspace_nav_items(workspace_id, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_nav_items TO authenticated;
GRANT ALL ON public.workspace_nav_items TO service_role;
ALTER TABLE public.workspace_nav_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_nav_select" ON public.workspace_nav_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "ws_nav_insert" ON public.workspace_nav_items FOR INSERT TO authenticated
  WITH CHECK (public.has_role('Super Admin') OR public.has_role('Admin'));
CREATE POLICY "ws_nav_update" ON public.workspace_nav_items FOR UPDATE TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin'));
CREATE POLICY "ws_nav_delete" ON public.workspace_nav_items FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

-- 4) Workspace-Berechtigungen
CREATE TABLE IF NOT EXISTS public.user_workspace_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, workspace_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_workspace_access TO authenticated;
GRANT ALL ON public.user_workspace_access TO service_role;
ALTER TABLE public.user_workspace_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uwa_select" ON public.user_workspace_access FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) OR public.has_role('Super Admin') OR public.has_role('Admin'));
CREATE POLICY "uwa_insert" ON public.user_workspace_access FOR INSERT TO authenticated
  WITH CHECK (public.has_role('Super Admin') OR public.has_role('Admin'));
CREATE POLICY "uwa_update" ON public.user_workspace_access FOR UPDATE TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin'));
CREATE POLICY "uwa_delete" ON public.user_workspace_access FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

-- 5) Updated-at Trigger
DROP TRIGGER IF EXISTS trg_workspaces_updated ON public.workspaces;
CREATE TRIGGER trg_workspaces_updated BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_ws_nav_updated ON public.workspace_nav_items;
CREATE TRIGGER trg_ws_nav_updated BEFORE UPDATE ON public.workspace_nav_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) Seed Workspaces
INSERT INTO public.workspaces (code, name, icon, emoji, dashboard_path, sort_order)
VALUES
  ('verkauf','Verkauf','TrendingUp','🏠','/w/verkauf',10),
  ('buchhaltung','Buchhaltung','Wallet','💰','/w/buchhaltung',20),
  ('lager','Lager','Warehouse','📦','/w/lager',30),
  ('fertigung','Fertigung','Factory','🏭','/w/fertigung',40),
  ('operation','Operation','Cog','⚙️','/w/operation',50)
ON CONFLICT (code) DO NOTHING;

-- 7) Mandant Alix Medical + CMR-Firmendaten
INSERT INTO public.tenants (code, name, country, currency, flag_emoji, is_active, sort_order)
SELECT 'MED','Alix Medical','DE','EUR','🩺',true,30
WHERE NOT EXISTS (SELECT 1 FROM public.tenants WHERE code = 'MED');

UPDATE public.tenants SET
  legal_name = COALESCE(legal_name,'Cloud Marketing Research'),
  address_line1 = COALESCE(address_line1,'Building A1, Dubai Digital Park'),
  address_line2 = COALESCE(address_line2,'Dubai Silicon Oasis'),
  city = COALESCE(city,'Dubai'),
  country_name = COALESCE(country_name,'United Arab Emirates'),
  phone = COALESCE(phone,'+971 254 9559'),
  whatsapp = COALESCE(whatsapp,'+971 254 9559'),
  website = COALESCE(website,'https://cmresearch.ae'),
  email = COALESCE(email,'dubai@cmresearch.ae')
WHERE code = 'CMR';