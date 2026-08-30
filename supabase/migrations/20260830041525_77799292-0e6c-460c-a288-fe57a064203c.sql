-- ============ ALIX PRODUCT MASTER (additiv auf ph_*) ============

ALTER TABLE public.ph_products
  ADD COLUMN IF NOT EXISTS ean text,
  ADD COLUMN IF NOT EXISTS manufacturer_sku text,
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS product_family text,
  ADD COLUMN IF NOT EXISTS series text,
  ADD COLUMN IF NOT EXISTS revision text,
  ADD COLUMN IF NOT EXISTS segment text,
  ADD COLUMN IF NOT EXISTS lifecycle_status text,
  ADD COLUMN IF NOT EXISTS quality_score integer;

-- ---------- Attribut-Engine ----------
CREATE TABLE IF NOT EXISTS public.ph_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  value_type text NOT NULL DEFAULT 'text',
  unit text,
  group_name text,
  categories text[] NOT NULL DEFAULT '{}',
  options text[] NOT NULL DEFAULT '{}',
  is_comparable boolean NOT NULL DEFAULT false,
  is_public boolean NOT NULL DEFAULT false,
  is_critical boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ph_attributes TO authenticated;
GRANT ALL ON public.ph_attributes TO service_role;
ALTER TABLE public.ph_attributes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.ph_attribute_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.ph_products(id) ON DELETE CASCADE,
  variant_id uuid,
  attribute_id uuid NOT NULL REFERENCES public.ph_attributes(id) ON DELETE CASCADE,
  value_text text,
  value_number numeric,
  value_list text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ph_attr_values_product ON public.ph_attribute_values(product_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ph_attribute_values TO authenticated;
GRANT ALL ON public.ph_attribute_values TO service_role;
ALTER TABLE public.ph_attribute_values ENABLE ROW LEVEL SECURITY;

-- ---------- Varianten ----------
CREATE TABLE IF NOT EXISTS public.ph_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.ph_products(id) ON DELETE CASCADE,
  name text NOT NULL,
  sku text,
  variant_type text,
  price_net numeric,
  stock integer,
  image_url text,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ph_variants_product ON public.ph_variants(product_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ph_variants TO authenticated;
GRANT ALL ON public.ph_variants TO service_role;
ALTER TABLE public.ph_variants ENABLE ROW LEVEL SECURITY;

-- ---------- Lieferumfang ----------
CREATE TABLE IF NOT EXISTS public.ph_scope_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.ph_products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.ph_variants(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  quantity numeric NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'Stk',
  mandatory boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ph_scope_product ON public.ph_scope_items(product_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ph_scope_items TO authenticated;
GRANT ALL ON public.ph_scope_items TO service_role;
ALTER TABLE public.ph_scope_items ENABLE ROW LEVEL SECURITY;

-- ---------- Preise ----------
CREATE TABLE IF NOT EXISTS public.ph_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.ph_products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.ph_variants(id) ON DELETE CASCADE,
  currency text NOT NULL DEFAULT 'EUR',
  purchase_price numeric,
  production_cost numeric,
  rrp_net numeric,
  sale_price_net numeric,
  promo_price_net numeric,
  promo_from date,
  promo_to date,
  vat_rate numeric NOT NULL DEFAULT 19,
  price_from boolean NOT NULL DEFAULT false,
  financing_available boolean NOT NULL DEFAULT false,
  leasing_available boolean NOT NULL DEFAULT false,
  down_payment numeric,
  monthly_rate numeric,
  delivery_time text,
  stock_status text,
  min_stock integer,
  warranty text,
  training_included boolean NOT NULL DEFAULT false,
  briefing_included boolean NOT NULL DEFAULT false,
  delivery_included boolean NOT NULL DEFAULT false,
  installation_included boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ph_prices_product ON public.ph_prices(product_id) WHERE variant_id IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ph_prices TO authenticated;
GRANT ALL ON public.ph_prices TO service_role;
ALTER TABLE public.ph_prices ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.ph_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  variant_id uuid,
  field text NOT NULL,
  old_value text,
  new_value text,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  reason text
);
CREATE INDEX IF NOT EXISTS idx_ph_price_hist_product ON public.ph_price_history(product_id, changed_at DESC);
GRANT SELECT, INSERT ON public.ph_price_history TO authenticated;
GRANT ALL ON public.ph_price_history TO service_role;
ALTER TABLE public.ph_price_history ENABLE ROW LEVEL SECURITY;

-- ---------- Compliance ----------
CREATE TABLE IF NOT EXISTS public.ph_compliance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL UNIQUE REFERENCES public.ph_products(id) ON DELETE CASCADE,
  ce_relevant boolean NOT NULL DEFAULT false,
  ce_status text,
  mdr_relevant boolean NOT NULL DEFAULT false,
  mdr_status text,
  is_medical_device boolean NOT NULL DEFAULT false,
  risk_class text,
  laser_class text,
  udi_required boolean NOT NULL DEFAULT false,
  udi_di text,
  basic_udi_di text,
  doc_declaration boolean NOT NULL DEFAULT false,
  doc_technical boolean NOT NULL DEFAULT false,
  doc_ifu boolean NOT NULL DEFAULT false,
  doc_test_reports boolean NOT NULL DEFAULT false,
  manufacturer text,
  eu_representative text,
  importer text,
  country_of_origin text,
  country_of_manufacture text,
  made_in_germany_approved boolean NOT NULL DEFAULT false,
  nisv_relevant boolean NOT NULL DEFAULT false,
  iso_13485 boolean NOT NULL DEFAULT false,
  notes text,
  approval_status text NOT NULL DEFAULT 'not_checked',
  approved_by uuid,
  approved_at timestamptz,
  approval_comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ph_compliance TO authenticated;
GRANT ALL ON public.ph_compliance TO service_role;
ALTER TABLE public.ph_compliance ENABLE ROW LEVEL SECURITY;

-- ---------- Marketing ----------
CREATE TABLE IF NOT EXISTS public.ph_marketing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL UNIQUE REFERENCES public.ph_products(id) ON DELETE CASCADE,
  headline text,
  short_text text,
  long_text text,
  usps text[] NOT NULL DEFAULT '{}',
  slogan text,
  why_this_device text,
  target_group text,
  main_applications text[] NOT NULL DEFAULT '{}',
  claims text[] NOT NULL DEFAULT '{}',
  cta text,
  approved boolean NOT NULL DEFAULT false,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ph_marketing TO authenticated;
GRANT ALL ON public.ph_marketing TO service_role;
ALTER TABLE public.ph_marketing ENABLE ROW LEVEL SECURITY;

-- ---------- SEO ----------
CREATE TABLE IF NOT EXISTS public.ph_seo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL UNIQUE REFERENCES public.ph_products(id) ON DELETE CASCADE,
  seo_title text,
  meta_description text,
  url_slug text,
  h1 text,
  main_keyword text,
  secondary_keywords text[] NOT NULL DEFAULT '{}',
  canonical_url text,
  noindex boolean NOT NULL DEFAULT false,
  faq jsonb NOT NULL DEFAULT '[]'::jsonb,
  schema_org jsonb,
  og_title text,
  og_description text,
  og_image text,
  landingpages text[] NOT NULL DEFAULT '{}',
  seo_score integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ph_seo TO authenticated;
GRANT ALL ON public.ph_seo TO service_role;
ALTER TABLE public.ph_seo ENABLE ROW LEVEL SECURITY;

-- ---------- Freigabe-Workflow ----------
CREATE TABLE IF NOT EXISTS public.ph_workflow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.ph_products(id) ON DELETE CASCADE,
  step text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  comment text,
  acted_by uuid,
  acted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ph_wf_product ON public.ph_workflow_steps(product_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ph_workflow_steps TO authenticated;
GRANT ALL ON public.ph_workflow_steps TO service_role;
ALTER TABLE public.ph_workflow_steps ENABLE ROW LEVEL SECURITY;

-- ---------- Policies (analog bestehende ph_* Policies) ----------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ph_attributes','ph_attribute_values','ph_variants','ph_scope_items',
                           'ph_prices','ph_compliance','ph_marketing','ph_seo','ph_workflow_steps']
  LOOP
    EXECUTE format('CREATE POLICY ph_read ON public.%I FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY ph_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (public.ph_can_edit())', t);
    EXECUTE format('CREATE POLICY ph_update ON public.%I FOR UPDATE TO authenticated USING (public.ph_can_edit()) WITH CHECK (public.ph_can_edit())', t);
    EXECUTE format('CREATE POLICY ph_delete ON public.%I FOR DELETE TO authenticated USING (public.has_role(''Super Admin''::text))', t);
  END LOOP;
END $$;

CREATE POLICY ph_read ON public.ph_price_history FOR SELECT TO authenticated USING (true);
CREATE POLICY ph_insert ON public.ph_price_history FOR INSERT TO authenticated WITH CHECK (public.ph_can_edit());

-- ---------- Trigger: Preishistorie ----------
CREATE OR REPLACE FUNCTION public.ph_log_price_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f text; oldv text; newv text;
BEGIN
  NEW.updated_at := now();
  FOREACH f IN ARRAY ARRAY['purchase_price','production_cost','rrp_net','sale_price_net','promo_price_net',
                           'vat_rate','down_payment','monthly_rate','delivery_time','warranty']
  LOOP
    EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', f, f) INTO oldv, newv USING OLD, NEW;
    IF oldv IS DISTINCT FROM newv THEN
      INSERT INTO public.ph_price_history(product_id, variant_id, field, old_value, new_value, changed_by)
      VALUES (NEW.product_id, NEW.variant_id, f, oldv, newv, auth.uid());
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ph_price_history ON public.ph_prices;
CREATE TRIGGER trg_ph_price_history BEFORE UPDATE ON public.ph_prices
FOR EACH ROW EXECUTE FUNCTION public.ph_log_price_changes();

-- ---------- Trigger: Compliance-Recheck bei kritischen Änderungen ----------
CREATE OR REPLACE FUNCTION public.ph_compliance_recheck()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.wavelengths IS DISTINCT FROM OLD.wavelengths
      OR NEW.power IS DISTINCT FROM OLD.power
      OR NEW.fluence IS DISTINCT FROM OLD.fluence
      OR NEW.pulse_duration IS DISTINCT FROM OLD.pulse_duration
      OR NEW.laser_class IS DISTINCT FROM OLD.laser_class
      OR NEW.intended_use IS DISTINCT FROM OLD.intended_use
      OR NEW.manufacturer IS DISTINCT FROM OLD.manufacturer) THEN
    UPDATE public.ph_compliance
       SET approval_status = 'recheck_required', updated_at = now()
     WHERE product_id = NEW.id AND approval_status = 'approved';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ph_compliance_recheck ON public.ph_products;
CREATE TRIGGER trg_ph_compliance_recheck AFTER UPDATE ON public.ph_products
FOR EACH ROW EXECUTE FUNCTION public.ph_compliance_recheck();