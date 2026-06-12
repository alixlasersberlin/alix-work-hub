
ALTER TABLE public.sales_leads
  ADD COLUMN IF NOT EXISTS interests jsonb,
  ADD COLUMN IF NOT EXISTS additional_interests jsonb,
  ADD COLUMN IF NOT EXISTS delivery_preference text,
  ADD COLUMN IF NOT EXISTS consultation_type text,
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS service_rating int,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS consent_data boolean,
  ADD COLUMN IF NOT EXISTS consent_contact boolean,
  ADD COLUMN IF NOT EXISTS lead_score int,
  ADD COLUMN IF NOT EXISTS score_category text,
  ADD COLUMN IF NOT EXISTS ai_summary text,
  ADD COLUMN IF NOT EXISTS ai_priority text,
  ADD COLUMN IF NOT EXISTS suggested_assignee text;
