
ALTER TABLE public.alixdocs_documents
  ADD COLUMN IF NOT EXISTS ocr_text text,
  ADD COLUMN IF NOT EXISTS ocr_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS ai_summary text,
  ADD COLUMN IF NOT EXISTS ai_category_suggestion text,
  ADD COLUMN IF NOT EXISTS ai_serial_numbers text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_order_numbers text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_model text,
  ADD COLUMN IF NOT EXISTS expiry_date date,
  ADD COLUMN IF NOT EXISTS expiry_warning_days int NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS duplicate_of uuid REFERENCES public.alixdocs_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS content_hash text;

CREATE INDEX IF NOT EXISTS idx_alixdocs_documents_fts
  ON public.alixdocs_documents
  USING gin (to_tsvector('german', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(ocr_text,'')));

CREATE INDEX IF NOT EXISTS idx_alixdocs_documents_expiry
  ON public.alixdocs_documents (expiry_date) WHERE expiry_date IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_alixdocs_documents_content_hash
  ON public.alixdocs_documents (content_hash) WHERE content_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.alixdocs_ai_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.alixdocs_documents(id) ON DELETE CASCADE,
  job_type text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  model text,
  error text,
  input_tokens int,
  output_tokens int,
  duration_ms int,
  triggered_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

GRANT SELECT ON public.alixdocs_ai_jobs TO authenticated;
GRANT ALL ON public.alixdocs_ai_jobs TO service_role;
ALTER TABLE public.alixdocs_ai_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alixdocs_ai_jobs_read_admins"
  ON public.alixdocs_ai_jobs FOR SELECT TO authenticated
  USING (
    public.has_role('Admin') OR
    public.has_role('Super Admin') OR
    public.has_role('Geschäftsführung')
  );

CREATE INDEX IF NOT EXISTS idx_alixdocs_ai_jobs_doc ON public.alixdocs_ai_jobs (document_id, created_at DESC);
