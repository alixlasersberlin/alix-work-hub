ALTER TABLE public.ph_products
  ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS source_name text,
  ADD COLUMN IF NOT EXISTS technology_claims text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS wavelengths_nm numeric[] NOT NULL DEFAULT '{}';

ALTER TABLE public.ph_documents
  ADD COLUMN IF NOT EXISTS resource_type text NOT NULL DEFAULT 'pdf';

UPDATE public.ph_documents
   SET resource_type = 'landing_page'
 WHERE url ILIKE '%/datenblatt/%';

CREATE TABLE IF NOT EXISTS public.ph_master_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.ph_products(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  proposed_value text,
  master_value text,
  previous_value text,
  source_of_truth text,
  verification_status text NOT NULL DEFAULT 'unverified',
  decision_status text NOT NULL DEFAULT 'review_required',
  note text,
  approved_by uuid,
  approved_by_email text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, field_name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ph_master_fields TO authenticated;
GRANT ALL ON public.ph_master_fields TO service_role;

ALTER TABLE public.ph_master_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ph_master_fields_read" ON public.ph_master_fields
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ph_master_fields_write" ON public.ph_master_fields
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER ph_master_fields_touch
  BEFORE UPDATE ON public.ph_master_fields
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();