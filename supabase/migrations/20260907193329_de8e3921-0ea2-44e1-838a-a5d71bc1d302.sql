-- ============ Product Hub Mehrsprachigkeit (additiv) ============

CREATE TABLE IF NOT EXISTS public.ph_product_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.ph_products(id) ON DELETE CASCADE,
  locale text NOT NULL CHECK (locale IN ('de','en','es','ru','ar')),
  name text,
  short_description text,
  long_description text,
  highlights jsonb NOT NULL DEFAULT '[]'::jsonb,
  benefits jsonb NOT NULL DEFAULT '[]'::jsonb,
  applications jsonb NOT NULL DEFAULT '[]'::jsonb,
  treatments jsonb NOT NULL DEFAULT '[]'::jsonb,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  marketing_text text,
  faq jsonb NOT NULL DEFAULT '[]'::jsonb,
  notices text,
  seo_title text,
  seo_description text,
  slug text,
  alt_texts jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'missing'
    CHECK (status IN ('missing','ai_draft','review','approved','published','outdated')),
  source_hash text,
  translated_at timestamptz,
  translated_by uuid,
  translation_source text,
  reviewed_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, locale)
);

CREATE INDEX IF NOT EXISTS idx_ph_translations_product ON public.ph_product_translations(product_id);
CREATE INDEX IF NOT EXISTS idx_ph_translations_locale ON public.ph_product_translations(locale, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ph_product_translations TO authenticated;
GRANT ALL ON public.ph_product_translations TO service_role;
ALTER TABLE public.ph_product_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ph_tr_read" ON public.ph_product_translations FOR SELECT TO authenticated USING (true);
CREATE POLICY "ph_tr_insert" ON public.ph_product_translations FOR INSERT TO authenticated WITH CHECK (ph_can_edit());
CREATE POLICY "ph_tr_update" ON public.ph_product_translations FOR UPDATE TO authenticated USING (ph_can_edit()) WITH CHECK (ph_can_edit());
CREATE POLICY "ph_tr_delete" ON public.ph_product_translations FOR DELETE TO authenticated USING (has_role('Super Admin'::text));

-- Glossar
CREATE TABLE IF NOT EXISTS public.ph_glossary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term text NOT NULL UNIQUE,
  mode text NOT NULL DEFAULT 'protected' CHECK (mode IN ('protected','fixed')),
  translations jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ph_glossary TO authenticated;
GRANT ALL ON public.ph_glossary TO service_role;
ALTER TABLE public.ph_glossary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ph_gl_read" ON public.ph_glossary FOR SELECT TO authenticated USING (true);
CREATE POLICY "ph_gl_insert" ON public.ph_glossary FOR INSERT TO authenticated WITH CHECK (ph_can_edit());
CREATE POLICY "ph_gl_update" ON public.ph_glossary FOR UPDATE TO authenticated USING (ph_can_edit()) WITH CHECK (ph_can_edit());
CREATE POLICY "ph_gl_delete" ON public.ph_glossary FOR DELETE TO authenticated USING (has_role('Super Admin'::text));

INSERT INTO public.ph_glossary (term, mode, note) VALUES
  ('ALIX','protected','Markenname'),
  ('ALIX LASERS','protected','Markenname'),
  ('ALIX MEDICAL','protected','Markenname'),
  ('BlueIce','protected','Produktname'),
  ('NEXUS','protected','Produktname'),
  ('SLIM III','protected','Produktname'),
  ('Aesthéra','protected','Produktname'),
  ('Smart KI','protected','Produkt-/Funktionsname'),
  ('iSense Pad','protected','Produktname')
ON CONFLICT (term) DO NOTHING;

-- updated_at
CREATE OR REPLACE FUNCTION public.ph_tr_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_ph_tr_touch ON public.ph_product_translations;
CREATE TRIGGER trg_ph_tr_touch BEFORE UPDATE ON public.ph_product_translations
FOR EACH ROW EXECUTE FUNCTION public.ph_tr_touch();

DROP TRIGGER IF EXISTS trg_ph_gl_touch ON public.ph_glossary;
CREATE TRIGGER trg_ph_gl_touch BEFORE UPDATE ON public.ph_glossary
FOR EACH ROW EXECUTE FUNCTION public.ph_tr_touch();

-- Master-Änderung -> Übersetzungen als veraltet markieren (nie löschen)
CREATE OR REPLACE FUNCTION public.ph_mark_translations_outdated()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.name IS DISTINCT FROM OLD.name
      OR NEW.short_description IS DISTINCT FROM OLD.short_description
      OR NEW.long_description IS DISTINCT FROM OLD.long_description
      OR NEW.features IS DISTINCT FROM OLD.features
      OR NEW.applications IS DISTINCT FROM OLD.applications
      OR NEW.intended_use IS DISTINCT FROM OLD.intended_use
      OR NEW.seo_title IS DISTINCT FROM OLD.seo_title
      OR NEW.seo_description IS DISTINCT FROM OLD.seo_description) THEN
    UPDATE public.ph_product_translations
       SET status = 'outdated'
     WHERE product_id = NEW.id
       AND locale <> 'de'
       AND status IN ('ai_draft','review','approved','published');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_ph_mark_translations_outdated ON public.ph_products;
CREATE TRIGGER trg_ph_mark_translations_outdated
AFTER UPDATE ON public.ph_products
FOR EACH ROW EXECUTE FUNCTION public.ph_mark_translations_outdated();