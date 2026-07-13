
-- ---------- Enums ----------
DO $$ BEGIN
  CREATE TYPE public.catalog_item_status AS ENUM (
    'entwurf','zur_pruefung','korrektur','freigegeben','gesperrt','archiviert',
    'aktiv','inaktiv','ausverkauft','vorbestellung','nur_auf_anfrage','nicht_lieferbar'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.catalog_price_status AS ENUM (
    'entwurf','zur_freigabe','freigegeben','abgelehnt','abgelaufen'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.catalog_translation_status AS ENUM (
    'nicht_begonnen','in_bearbeitung','maschinell','geprueft','freigegeben'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.catalog_price_rule_mode AS ENUM (
    'uvp_minus_pct','uvp_plus_pct','uvp_factor','fixed','rounding'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- Helpers ----------
CREATE OR REPLACE FUNCTION public.catalog_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.catalog_can_edit()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog') $$;

CREATE OR REPLACE FUNCTION public.catalog_can_manage_prices()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog Preise') $$;

REVOKE EXECUTE ON FUNCTION public.catalog_can_edit() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.catalog_can_manage_prices() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.catalog_can_edit() TO authenticated;
GRANT EXECUTE ON FUNCTION public.catalog_can_manage_prices() TO authenticated;

-- ---------- Sprachen ----------
CREATE TABLE IF NOT EXISTS public.catalog_languages (
  code text PRIMARY KEY,
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.catalog_languages TO authenticated;
GRANT ALL ON public.catalog_languages TO service_role;
ALTER TABLE public.catalog_languages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_lang_read" ON public.catalog_languages FOR SELECT TO authenticated USING (true);
CREATE POLICY "cat_lang_manage" ON public.catalog_languages FOR ALL TO authenticated
  USING (public.catalog_can_edit()) WITH CHECK (public.catalog_can_edit());
CREATE POLICY "cat_lang_delete_sa" ON public.catalog_languages FOR DELETE TO authenticated USING (has_role('Super Admin'));
CREATE TRIGGER trg_cat_lang_upd BEFORE UPDATE ON public.catalog_languages FOR EACH ROW EXECUTE FUNCTION public.catalog_touch_updated_at();
INSERT INTO public.catalog_languages(code,name,is_default,sort_order) VALUES
  ('de','Deutsch',true,10),('en','English',false,20),('ar','العربية',false,30),
  ('tr','Türkçe',false,40),('fr','Français',false,50),('it','Italiano',false,60),
  ('es','Español',false,70)
ON CONFLICT (code) DO NOTHING;

-- ---------- Währungen ----------
CREATE TABLE IF NOT EXISTS public.catalog_currencies (
  code text PRIMARY KEY,
  symbol text,
  name text NOT NULL,
  rounding numeric NOT NULL DEFAULT 0.01,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.catalog_currencies TO authenticated;
GRANT ALL ON public.catalog_currencies TO service_role;
ALTER TABLE public.catalog_currencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_cur_read" ON public.catalog_currencies FOR SELECT TO authenticated USING (true);
CREATE POLICY "cat_cur_manage" ON public.catalog_currencies FOR ALL TO authenticated
  USING (public.catalog_can_manage_prices()) WITH CHECK (public.catalog_can_manage_prices());
CREATE POLICY "cat_cur_delete_sa" ON public.catalog_currencies FOR DELETE TO authenticated USING (has_role('Super Admin'));
CREATE TRIGGER trg_cat_cur_upd BEFORE UPDATE ON public.catalog_currencies FOR EACH ROW EXECUTE FUNCTION public.catalog_touch_updated_at();
INSERT INTO public.catalog_currencies(code,symbol,name,rounding) VALUES
  ('EUR','€','Euro',0.01),('USD','$','US Dollar',0.01),
  ('AED','د.إ','UAE Dirham',0.01),('CHF','CHF','Swiss Franc',0.05)
ON CONFLICT (code) DO NOTHING;

-- ---------- Länder ----------
CREATE TABLE IF NOT EXISTS public.catalog_countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iso_code text NOT NULL UNIQUE,
  name text NOT NULL,
  currency_code text NOT NULL REFERENCES public.catalog_currencies(code),
  default_language text REFERENCES public.catalog_languages(code),
  default_tax_rate numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.catalog_countries TO authenticated;
GRANT ALL ON public.catalog_countries TO service_role;
ALTER TABLE public.catalog_countries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_country_read" ON public.catalog_countries FOR SELECT TO authenticated USING (true);
CREATE POLICY "cat_country_manage" ON public.catalog_countries FOR ALL TO authenticated
  USING (public.catalog_can_edit()) WITH CHECK (public.catalog_can_edit());
CREATE POLICY "cat_country_delete_sa" ON public.catalog_countries FOR DELETE TO authenticated USING (has_role('Super Admin'));
CREATE TRIGGER trg_cat_country_upd BEFORE UPDATE ON public.catalog_countries FOR EACH ROW EXECUTE FUNCTION public.catalog_touch_updated_at();
INSERT INTO public.catalog_countries(iso_code,name,currency_code,default_language,default_tax_rate,sort_order) VALUES
  ('DE','Deutschland','EUR','de',19,10),('AT','Österreich','EUR','de',20,20),
  ('CH','Schweiz','CHF','de',8.1,30),('US','USA','USD','en',0,40),
  ('AE','Vereinigte Arabische Emirate','AED','en',5,50),('INT','International','EUR','en',0,999)
ON CONFLICT (iso_code) DO NOTHING;

-- ---------- Niederlassungen ----------
CREATE TABLE IF NOT EXISTS public.catalog_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  company_name text,
  country_id uuid REFERENCES public.catalog_countries(id),
  currency_code text REFERENCES public.catalog_currencies(code),
  default_language text REFERENCES public.catalog_languages(code),
  address text, phone text, email text, website text,
  logo_url text, tax_default numeric, pricelist_label text,
  pdf_footer text, legal_notice text, bank_details jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.catalog_branches TO authenticated;
GRANT ALL ON public.catalog_branches TO service_role;
ALTER TABLE public.catalog_branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_branch_read" ON public.catalog_branches FOR SELECT TO authenticated USING (true);
CREATE POLICY "cat_branch_manage" ON public.catalog_branches FOR ALL TO authenticated
  USING (public.catalog_can_edit()) WITH CHECK (public.catalog_can_edit());
CREATE POLICY "cat_branch_delete_sa" ON public.catalog_branches FOR DELETE TO authenticated USING (has_role('Super Admin'));
CREATE TRIGGER trg_cat_branch_upd BEFORE UPDATE ON public.catalog_branches FOR EACH ROW EXECUTE FUNCTION public.catalog_touch_updated_at();
INSERT INTO public.catalog_branches(code,name,company_name,currency_code,default_language,sort_order) VALUES
  ('DE','Alix Lasers Deutschland','Alix Lasers GmbH','EUR','de',10),
  ('AT','Alix Lasers Österreich','Alix Lasers Austria GmbH','EUR','de',20),
  ('US','Alix Lasers USA','Alix Lasers USA LLC','USD','en',30),
  ('AE','Alix Lasers Dubai','Alix Lasers FZ-LLC','AED','en',40)
ON CONFLICT (code) DO NOTHING;

-- ---------- Kategorien ----------
CREATE TABLE IF NOT EXISTS public.catalog_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES public.catalog_categories(id) ON DELETE SET NULL,
  slug text NOT NULL UNIQUE,
  names jsonb NOT NULL DEFAULT '{}'::jsonb,
  descriptions jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.catalog_categories TO authenticated;
GRANT ALL ON public.catalog_categories TO service_role;
ALTER TABLE public.catalog_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_cat_read" ON public.catalog_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "cat_cat_manage" ON public.catalog_categories FOR ALL TO authenticated
  USING (public.catalog_can_edit()) WITH CHECK (public.catalog_can_edit());
CREATE POLICY "cat_cat_delete_sa" ON public.catalog_categories FOR DELETE TO authenticated USING (has_role('Super Admin'));
CREATE TRIGGER trg_cat_cat_upd BEFORE UPDATE ON public.catalog_categories FOR EACH ROW EXECUTE FUNCTION public.catalog_touch_updated_at();

-- ---------- Artikel ----------
CREATE TABLE IF NOT EXISTS public.catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL UNIQUE,
  internal_number text UNIQUE,
  ean text,
  name text NOT NULL,
  short_name text,
  manufacturer text,
  brand text, model text, variant text, item_type text,
  category_id uuid REFERENCES public.catalog_categories(id) ON DELETE SET NULL,
  status public.catalog_item_status NOT NULL DEFAULT 'entwurf',
  source_system text, source_ref text,
  default_currency text REFERENCES public.catalog_currencies(code),
  default_language text REFERENCES public.catalog_languages(code),
  primary_image_id uuid,
  notes_internal text,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid
);
CREATE INDEX IF NOT EXISTS idx_catalog_items_status ON public.catalog_items(status);
CREATE INDEX IF NOT EXISTS idx_catalog_items_category ON public.catalog_items(category_id);
CREATE INDEX IF NOT EXISTS idx_catalog_items_brand ON public.catalog_items(brand);
GRANT SELECT, INSERT, UPDATE ON public.catalog_items TO authenticated;
GRANT ALL ON public.catalog_items TO service_role;
ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_items_read" ON public.catalog_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "cat_items_insert" ON public.catalog_items FOR INSERT TO authenticated WITH CHECK (public.catalog_can_edit());
CREATE POLICY "cat_items_update" ON public.catalog_items FOR UPDATE TO authenticated USING (public.catalog_can_edit()) WITH CHECK (public.catalog_can_edit());
CREATE POLICY "cat_items_delete_sa" ON public.catalog_items FOR DELETE TO authenticated USING (has_role('Super Admin'));
CREATE TRIGGER trg_cat_items_upd BEFORE UPDATE ON public.catalog_items FOR EACH ROW EXECUTE FUNCTION public.catalog_touch_updated_at();

-- ---------- Beschreibungen pro Sprache ----------
CREATE TABLE IF NOT EXISTS public.catalog_item_descriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  language_code text NOT NULL REFERENCES public.catalog_languages(code),
  name text, short_name text,
  short_description text, long_description text, technical_description text,
  selling_points text, scope_of_delivery text, optional_equipment text, accessories text,
  warranty text, service_notes text, offer_description text, pdf_description text, legal_notice text,
  translation_status public.catalog_translation_status NOT NULL DEFAULT 'nicht_begonnen',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(item_id, language_code)
);
GRANT SELECT, INSERT, UPDATE ON public.catalog_item_descriptions TO authenticated;
GRANT ALL ON public.catalog_item_descriptions TO service_role;
ALTER TABLE public.catalog_item_descriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_desc_read" ON public.catalog_item_descriptions FOR SELECT TO authenticated USING (true);
CREATE POLICY "cat_desc_write" ON public.catalog_item_descriptions FOR INSERT TO authenticated WITH CHECK (public.catalog_can_edit());
CREATE POLICY "cat_desc_update" ON public.catalog_item_descriptions FOR UPDATE TO authenticated USING (public.catalog_can_edit()) WITH CHECK (public.catalog_can_edit());
CREATE POLICY "cat_desc_delete_sa" ON public.catalog_item_descriptions FOR DELETE TO authenticated USING (has_role('Super Admin'));
CREATE TRIGGER trg_cat_desc_upd BEFORE UPDATE ON public.catalog_item_descriptions FOR EACH ROW EXECUTE FUNCTION public.catalog_touch_updated_at();

-- ---------- Bilder ----------
CREATE TABLE IF NOT EXISTS public.catalog_item_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text, file_type text, file_size bigint,
  title text, alt_text text,
  language_code text REFERENCES public.catalog_languages(code),
  sort_order integer NOT NULL DEFAULT 100,
  is_primary boolean NOT NULL DEFAULT false,
  is_approved boolean NOT NULL DEFAULT false,
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_catalog_images_item ON public.catalog_item_images(item_id, sort_order);
GRANT SELECT, INSERT, UPDATE ON public.catalog_item_images TO authenticated;
GRANT ALL ON public.catalog_item_images TO service_role;
ALTER TABLE public.catalog_item_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_img_read" ON public.catalog_item_images FOR SELECT TO authenticated USING (true);
CREATE POLICY "cat_img_write" ON public.catalog_item_images FOR INSERT TO authenticated WITH CHECK (public.catalog_can_edit());
CREATE POLICY "cat_img_update" ON public.catalog_item_images FOR UPDATE TO authenticated USING (public.catalog_can_edit()) WITH CHECK (public.catalog_can_edit());
CREATE POLICY "cat_img_delete_sa" ON public.catalog_item_images FOR DELETE TO authenticated USING (has_role('Super Admin'));
CREATE TRIGGER trg_cat_img_upd BEFORE UPDATE ON public.catalog_item_images FOR EACH ROW EXECUTE FUNCTION public.catalog_touch_updated_at();

-- ---------- Länderpreise (KEINE Einkaufspreise) ----------
CREATE TABLE IF NOT EXISTS public.catalog_item_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  country_id uuid NOT NULL REFERENCES public.catalog_countries(id),
  branch_id uuid REFERENCES public.catalog_branches(id),
  currency_code text NOT NULL REFERENCES public.catalog_currencies(code),
  uvp_net numeric, uvp_gross numeric,
  standard_net numeric, standard_gross numeric,
  promo_net numeric, promo_gross numeric,
  tax_rate numeric, valid_from date, valid_until date,
  rule_id uuid, rounding numeric, pricelist_label text,
  price_status public.catalog_price_status NOT NULL DEFAULT 'entwurf',
  approved_by uuid, approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cat_price_item ON public.catalog_item_prices(item_id);
CREATE INDEX IF NOT EXISTS idx_cat_price_country ON public.catalog_item_prices(country_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cat_price_freigegeben
  ON public.catalog_item_prices(item_id, country_id, coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE price_status = 'freigegeben';
GRANT SELECT, INSERT, UPDATE ON public.catalog_item_prices TO authenticated;
GRANT ALL ON public.catalog_item_prices TO service_role;
ALTER TABLE public.catalog_item_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_prices_read" ON public.catalog_item_prices FOR SELECT TO authenticated USING (true);
CREATE POLICY "cat_prices_insert" ON public.catalog_item_prices FOR INSERT TO authenticated WITH CHECK (public.catalog_can_manage_prices());
CREATE POLICY "cat_prices_update" ON public.catalog_item_prices FOR UPDATE TO authenticated USING (public.catalog_can_manage_prices()) WITH CHECK (public.catalog_can_manage_prices());
CREATE POLICY "cat_prices_delete_sa" ON public.catalog_item_prices FOR DELETE TO authenticated USING (has_role('Super Admin'));
CREATE TRIGGER trg_cat_prices_upd BEFORE UPDATE ON public.catalog_item_prices FOR EACH ROW EXECUTE FUNCTION public.catalog_touch_updated_at();

-- ---------- Preisregeln ----------
CREATE TABLE IF NOT EXISTS public.catalog_price_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL, description text,
  mode public.catalog_price_rule_mode NOT NULL,
  percent_value numeric, factor_value numeric, fixed_value numeric, rounding numeric,
  applies_country uuid REFERENCES public.catalog_countries(id),
  applies_branch uuid REFERENCES public.catalog_branches(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.catalog_price_rules TO authenticated;
GRANT ALL ON public.catalog_price_rules TO service_role;
ALTER TABLE public.catalog_price_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_rules_read" ON public.catalog_price_rules FOR SELECT TO authenticated USING (public.catalog_can_manage_prices());
CREATE POLICY "cat_rules_insert" ON public.catalog_price_rules FOR INSERT TO authenticated WITH CHECK (public.catalog_can_manage_prices());
CREATE POLICY "cat_rules_update" ON public.catalog_price_rules FOR UPDATE TO authenticated USING (public.catalog_can_manage_prices()) WITH CHECK (public.catalog_can_manage_prices());
CREATE POLICY "cat_rules_delete_sa" ON public.catalog_price_rules FOR DELETE TO authenticated USING (has_role('Super Admin'));
CREATE TRIGGER trg_cat_rules_upd BEFORE UPDATE ON public.catalog_price_rules FOR EACH ROW EXECUTE FUNCTION public.catalog_touch_updated_at();

-- ---------- Änderungsprotokoll ----------
CREATE TABLE IF NOT EXISTS public.catalog_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  field_name text,
  old_value jsonb, new_value jsonb,
  action text NOT NULL, source text,
  performed_by uuid,
  performed_at timestamptz NOT NULL DEFAULT now(),
  note text
);
CREATE INDEX IF NOT EXISTS idx_cat_log_entity ON public.catalog_change_log(entity_type, entity_id, performed_at DESC);
GRANT SELECT, INSERT ON public.catalog_change_log TO authenticated;
GRANT ALL ON public.catalog_change_log TO service_role;
ALTER TABLE public.catalog_change_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_log_read" ON public.catalog_change_log FOR SELECT TO authenticated
  USING (public.catalog_can_edit() OR public.catalog_can_manage_prices());
CREATE POLICY "cat_log_insert" ON public.catalog_change_log FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "cat_log_delete_sa" ON public.catalog_change_log FOR DELETE TO authenticated USING (has_role('Super Admin'));

-- ---------- Snapshots (für spätere Angebots-/Auftragsübernahme) ----------
CREATE TABLE IF NOT EXISTS public.catalog_item_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.catalog_items(id) ON DELETE RESTRICT,
  snapshot jsonb NOT NULL,
  used_in_type text, used_in_id text,
  language_code text, country_iso text, branch_code text, currency_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE INDEX IF NOT EXISTS idx_cat_snap_item ON public.catalog_item_snapshots(item_id);
CREATE INDEX IF NOT EXISTS idx_cat_snap_usage ON public.catalog_item_snapshots(used_in_type, used_in_id);
GRANT SELECT, INSERT ON public.catalog_item_snapshots TO authenticated;
GRANT ALL ON public.catalog_item_snapshots TO service_role;
ALTER TABLE public.catalog_item_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_snap_read" ON public.catalog_item_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "cat_snap_insert" ON public.catalog_item_snapshots FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "cat_snap_delete_sa" ON public.catalog_item_snapshots FOR DELETE TO authenticated USING (has_role('Super Admin'));

-- ---------- Neue Rollen (additiv) ----------
INSERT INTO public.roles(name, description) VALUES
  ('Katalog','Bearbeitet Katalog-Artikel, Bilder, Beschreibungen und Kategorien.'),
  ('Katalog Preise','Bearbeitet und gibt Länderpreise und Preisregeln im Katalog frei.')
ON CONFLICT (name) DO NOTHING;
