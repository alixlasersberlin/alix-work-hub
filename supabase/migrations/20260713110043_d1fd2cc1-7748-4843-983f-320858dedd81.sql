CREATE TABLE public.catalog_bundle_price_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id UUID NOT NULL REFERENCES public.catalog_bundles(id) ON DELETE CASCADE,
  min_quantity INTEGER NOT NULL CHECK (min_quantity >= 1),
  discount_pct NUMERIC(6,3) NOT NULL DEFAULT 0 CHECK (discount_pct >= 0 AND discount_pct <= 100),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bundle_id, min_quantity)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_bundle_price_tiers TO authenticated;
GRANT ALL ON public.catalog_bundle_price_tiers TO service_role;

ALTER TABLE public.catalog_bundle_price_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tiers_read_all_auth" ON public.catalog_bundle_price_tiers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "tiers_write_admin_catalog" ON public.catalog_bundle_price_tiers
  FOR ALL TO authenticated
  USING (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('Katalog'::text))
  WITH CHECK (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('Katalog'::text));

CREATE TRIGGER trg_catalog_bundle_price_tiers_updated
  BEFORE UPDATE ON public.catalog_bundle_price_tiers
  FOR EACH ROW EXECUTE FUNCTION public.catalog_touch_updated_at();

CREATE INDEX idx_catalog_bundle_price_tiers_bundle ON public.catalog_bundle_price_tiers(bundle_id, min_quantity);