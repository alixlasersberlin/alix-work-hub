ALTER TABLE public.cmr_time_entries
  ADD COLUMN IF NOT EXISTS worked_by uuid,
  ADD COLUMN IF NOT EXISTS worked_by_name text,
  ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

ALTER TABLE public.cmr_pdf_templates
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'de';

ALTER TABLE public.cmr_customer_dunning
  ADD COLUMN IF NOT EXISTS language text;

ALTER TABLE public.cmr_documents
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'de',
  ADD COLUMN IF NOT EXISTS payment_link_url text;

ALTER TABLE public.cmr_settings
  ADD COLUMN IF NOT EXISTS portal_payment_url text;

CREATE TABLE IF NOT EXISTS public.cmr_job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  job text NOT NULL,
  status text NOT NULL DEFAULT 'ok',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  processed integer NOT NULL DEFAULT 0,
  skipped integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  message text,
  details jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.cmr_job_runs TO authenticated;
GRANT ALL ON public.cmr_job_runs TO service_role;

ALTER TABLE public.cmr_job_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cmr_job_runs_read" ON public.cmr_job_runs;
CREATE POLICY "cmr_job_runs_read" ON public.cmr_job_runs
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_cmr_job_runs_started ON public.cmr_job_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cmr_time_entries_worked_by ON public.cmr_time_entries (worked_by);

DROP TRIGGER IF EXISTS trg_cmr_job_runs_updated ON public.cmr_job_runs;
CREATE TRIGGER trg_cmr_job_runs_updated
  BEFORE UPDATE ON public.cmr_job_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();