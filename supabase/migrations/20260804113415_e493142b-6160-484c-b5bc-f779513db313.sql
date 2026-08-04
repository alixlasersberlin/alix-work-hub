ALTER TABLE public.zoho_recurring_profiles
  ADD COLUMN IF NOT EXISTS delivery_date date,
  ADD COLUMN IF NOT EXISTS delivery_source text,
  ADD COLUMN IF NOT EXISTS delivery_document_id uuid;