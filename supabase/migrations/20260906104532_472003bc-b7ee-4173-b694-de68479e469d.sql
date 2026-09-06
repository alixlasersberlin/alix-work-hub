
CREATE TABLE public.ph_catalogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  internal_name text,
  variant text NOT NULL DEFAULT 'endkunde',
  language text NOT NULL DEFAULT 'de',
  currency text NOT NULL DEFAULT 'EUR',
  country text NOT NULL DEFAULT 'de',
  valid_from date,
  valid_to date,
  contact text,
  notes text,
  status text NOT NULL DEFAULT 'draft',
  template_key text,
  cover jsonb NOT NULL DEFAULT '{}'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  slug text UNIQUE,
  is_public boolean NOT NULL DEFAULT false,
  access_password text,
  expires_at date,
  noindex boolean NOT NULL DEFAULT true,
  pdf_stale boolean NOT NULL DEFAULT true,
  pdf_generated_at timestamptz,
  version int NOT NULL DEFAULT 1,
  version_label text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ph_catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id uuid NOT NULL REFERENCES public.ph_catalogs(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.ph_products(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  layout text NOT NULL DEFAULT 'layout1',
  prices jsonb NOT NULL DEFAULT '{}'::jsonb,
  fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  image_mode text NOT NULL DEFAULT 'hub',
  image_url text,
  badges text[] NOT NULL DEFAULT '{}',
  visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (catalog_id, product_id)
);

CREATE TABLE public.ph_catalog_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id uuid NOT NULL REFERENCES public.ph_catalogs(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  page_type text NOT NULL DEFAULT 'content',
  title text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ph_catalog_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id uuid REFERENCES public.ph_catalogs(id) ON DELETE CASCADE,
  url text NOT NULL,
  title text,
  kind text NOT NULL DEFAULT 'upload',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ph_catalog_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id uuid NOT NULL REFERENCES public.ph_catalogs(id) ON DELETE CASCADE,
  version int NOT NULL,
  version_label text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ph_catalog_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ph_catalogs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ph_catalog_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ph_catalog_pages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ph_catalog_media TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ph_catalog_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ph_catalog_templates TO authenticated;
GRANT SELECT ON public.ph_catalogs TO anon;
GRANT SELECT ON public.ph_catalog_items TO anon;
GRANT SELECT ON public.ph_catalog_pages TO anon;
GRANT SELECT ON public.ph_catalog_media TO anon;
GRANT ALL ON public.ph_catalogs TO service_role;
GRANT ALL ON public.ph_catalog_items TO service_role;
GRANT ALL ON public.ph_catalog_pages TO service_role;
GRANT ALL ON public.ph_catalog_media TO service_role;
GRANT ALL ON public.ph_catalog_versions TO service_role;
GRANT ALL ON public.ph_catalog_templates TO service_role;

ALTER TABLE public.ph_catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ph_catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ph_catalog_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ph_catalog_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ph_catalog_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ph_catalog_templates ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.ph_catalog_public(_catalog_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ph_catalogs c
    WHERE c.id = _catalog_id
      AND c.status = 'published'
      AND c.is_public = true
      AND (c.expires_at IS NULL OR c.expires_at >= current_date)
  )
$$;

CREATE POLICY ph_cat_read ON public.ph_catalogs FOR SELECT TO authenticated USING (true);
CREATE POLICY ph_cat_insert ON public.ph_catalogs FOR INSERT TO authenticated WITH CHECK (ph_can_edit());
CREATE POLICY ph_cat_update ON public.ph_catalogs FOR UPDATE TO authenticated USING (ph_can_edit()) WITH CHECK (ph_can_edit());
CREATE POLICY ph_cat_delete ON public.ph_catalogs FOR DELETE TO authenticated USING (has_role('Super Admin'::text));
CREATE POLICY ph_cat_public ON public.ph_catalogs FOR SELECT TO anon USING (status = 'published' AND is_public = true AND (expires_at IS NULL OR expires_at >= current_date));

CREATE POLICY ph_cat_items_read ON public.ph_catalog_items FOR SELECT TO authenticated USING (true);
CREATE POLICY ph_cat_items_insert ON public.ph_catalog_items FOR INSERT TO authenticated WITH CHECK (ph_can_edit());
CREATE POLICY ph_cat_items_update ON public.ph_catalog_items FOR UPDATE TO authenticated USING (ph_can_edit()) WITH CHECK (ph_can_edit());
CREATE POLICY ph_cat_items_delete ON public.ph_catalog_items FOR DELETE TO authenticated USING (ph_can_edit());
CREATE POLICY ph_cat_items_public ON public.ph_catalog_items FOR SELECT TO anon USING (ph_catalog_public(catalog_id));

CREATE POLICY ph_cat_pages_read ON public.ph_catalog_pages FOR SELECT TO authenticated USING (true);
CREATE POLICY ph_cat_pages_insert ON public.ph_catalog_pages FOR INSERT TO authenticated WITH CHECK (ph_can_edit());
CREATE POLICY ph_cat_pages_update ON public.ph_catalog_pages FOR UPDATE TO authenticated USING (ph_can_edit()) WITH CHECK (ph_can_edit());
CREATE POLICY ph_cat_pages_delete ON public.ph_catalog_pages FOR DELETE TO authenticated USING (ph_can_edit());
CREATE POLICY ph_cat_pages_public ON public.ph_catalog_pages FOR SELECT TO anon USING (ph_catalog_public(catalog_id));

CREATE POLICY ph_cat_media_read ON public.ph_catalog_media FOR SELECT TO authenticated USING (true);
CREATE POLICY ph_cat_media_insert ON public.ph_catalog_media FOR INSERT TO authenticated WITH CHECK (ph_can_edit());
CREATE POLICY ph_cat_media_update ON public.ph_catalog_media FOR UPDATE TO authenticated USING (ph_can_edit()) WITH CHECK (ph_can_edit());
CREATE POLICY ph_cat_media_delete ON public.ph_catalog_media FOR DELETE TO authenticated USING (ph_can_edit());
CREATE POLICY ph_cat_media_public ON public.ph_catalog_media FOR SELECT TO anon USING (catalog_id IS NOT NULL AND ph_catalog_public(catalog_id));

CREATE POLICY ph_cat_ver_read ON public.ph_catalog_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY ph_cat_ver_insert ON public.ph_catalog_versions FOR INSERT TO authenticated WITH CHECK (ph_can_edit());
CREATE POLICY ph_cat_ver_delete ON public.ph_catalog_versions FOR DELETE TO authenticated USING (has_role('Super Admin'::text));

CREATE POLICY ph_cat_tpl_read ON public.ph_catalog_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY ph_cat_tpl_insert ON public.ph_catalog_templates FOR INSERT TO authenticated WITH CHECK (ph_can_edit());
CREATE POLICY ph_cat_tpl_update ON public.ph_catalog_templates FOR UPDATE TO authenticated USING (ph_can_edit()) WITH CHECK (ph_can_edit());
CREATE POLICY ph_cat_tpl_delete ON public.ph_catalog_templates FOR DELETE TO authenticated USING (has_role('Super Admin'::text));

CREATE INDEX idx_ph_catalog_items_catalog ON public.ph_catalog_items(catalog_id, sort_order);
CREATE INDEX idx_ph_catalog_items_product ON public.ph_catalog_items(product_id);
CREATE INDEX idx_ph_catalog_pages_catalog ON public.ph_catalog_pages(catalog_id, sort_order);

CREATE TRIGGER trg_ph_catalogs_updated BEFORE UPDATE ON public.ph_catalogs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ph_catalog_items_updated BEFORE UPDATE ON public.ph_catalog_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ph_catalog_pages_updated BEFORE UPDATE ON public.ph_catalog_pages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.ph_catalog_templates (key, name, description, is_system, config) VALUES
 ('standard','ALIX LASERS STANDARD','Klassischer Gerätekatalog mit Cover, Kategorien und Produktseiten', true, '{"layout":"layout1","priceKinds":["uvp","promo","rent"]}'),
 ('medical','ALIX MEDICAL','Medizinischer Katalog mit technischem Layout', true, '{"layout":"layout4","priceKinds":["uvp","vk"]}'),
 ('messe','MESSE','Messekatalog mit Aktionspreisen', true, '{"layout":"layout3","priceKinds":["uvp","fair","promo"]}'),
 ('miete','MIETKATALOG','Mietpreisliste mit Monatsraten', true, '{"layout":"layout2","priceKinds":["rent","deposit"]}'),
 ('distributor','DISTRIBUTOR','Händler- und Distributorpreise', true, '{"layout":"layout5","priceKinds":["dealer","distributor"]}'),
 ('minimal','MINIMAL','Kompakte Preisliste ohne viel Grafik', true, '{"layout":"layout5","priceKinds":["uvp"]}'),
 ('luxury','LUXURY','Großflächige Bilder, wenig Text, großer Preis', true, '{"layout":"layout3","priceKinds":["uvp","promo"]}');
