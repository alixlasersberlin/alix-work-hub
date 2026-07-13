
CREATE TABLE IF NOT EXISTS public.catalog_share_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  item_id UUID NOT NULL REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL DEFAULT 'de',
  country_id UUID REFERENCES public.catalog_countries(id) ON DELETE SET NULL,
  recipient_name TEXT,
  recipient_email TEXT,
  recipient_phone TEXT,
  channel TEXT NOT NULL DEFAULT 'link',
  expires_at TIMESTAMPTZ,
  view_count INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catalog_share_links_item ON public.catalog_share_links(item_id);
CREATE INDEX IF NOT EXISTS idx_catalog_share_links_token ON public.catalog_share_links(token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_share_links TO authenticated;
GRANT ALL ON public.catalog_share_links TO service_role;

ALTER TABLE public.catalog_share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Catalog roles can view share links"
  ON public.catalog_share_links FOR SELECT TO authenticated
  USING (
    public.has_role('Super Admin') OR public.has_role('Admin') OR
    public.has_role('Katalog') OR public.has_role('Katalog Preise') OR
    public.has_role('Vertrieb') OR public.has_role('Vertriebsleitung')
  );

CREATE POLICY "Catalog roles can create share links"
  ON public.catalog_share_links FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role('Super Admin') OR public.has_role('Admin') OR
    public.has_role('Katalog') OR public.has_role('Vertrieb') OR public.has_role('Vertriebsleitung')
  );

CREATE POLICY "Catalog roles can update share links"
  ON public.catalog_share_links FOR UPDATE TO authenticated
  USING (
    public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Katalog')
  );

CREATE POLICY "Only Super Admin can delete share links"
  ON public.catalog_share_links FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

CREATE TRIGGER trg_catalog_share_links_upd
  BEFORE UPDATE ON public.catalog_share_links
  FOR EACH ROW EXECUTE FUNCTION public.catalog_touch_updated_at();
