
CREATE TABLE public.catalog_bundles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  default_discount_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_bundles TO authenticated;
GRANT ALL ON public.catalog_bundles TO service_role;
ALTER TABLE public.catalog_bundles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bundles_read_all_auth" ON public.catalog_bundles FOR SELECT TO authenticated USING (true);
CREATE POLICY "bundles_write_admin_catalog" ON public.catalog_bundles FOR ALL TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Katalog'))
  WITH CHECK (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Katalog'));
CREATE TRIGGER trg_catalog_bundles_updated_at BEFORE UPDATE ON public.catalog_bundles
  FOR EACH ROW EXECUTE FUNCTION public.catalog_touch_updated_at();

CREATE TABLE public.catalog_bundle_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bundle_id UUID NOT NULL REFERENCES public.catalog_bundles(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  discount_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
  note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_optional BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_catalog_bundle_items_bundle ON public.catalog_bundle_items(bundle_id);
CREATE INDEX idx_catalog_bundle_items_item ON public.catalog_bundle_items(item_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_bundle_items TO authenticated;
GRANT ALL ON public.catalog_bundle_items TO service_role;
ALTER TABLE public.catalog_bundle_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bundle_items_read_all_auth" ON public.catalog_bundle_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "bundle_items_write_admin_catalog" ON public.catalog_bundle_items FOR ALL TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Katalog'))
  WITH CHECK (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Katalog'));
CREATE TRIGGER trg_catalog_bundle_items_updated_at BEFORE UPDATE ON public.catalog_bundle_items
  FOR EACH ROW EXECUTE FUNCTION public.catalog_touch_updated_at();
