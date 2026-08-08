CREATE TABLE public.zoho_auto_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type text NOT NULL DEFAULT 'cron',
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  sources text[] NOT NULL DEFAULT ARRAY['zoho_eu_1','zoho_eu_2'],
  new_count integer NOT NULL DEFAULT 0,
  changed_count integer NOT NULL DEFAULT 0,
  unchanged_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  processed_count integer NOT NULL DEFAULT 0,
  changes jsonb NOT NULL DEFAULT '[]'::jsonb,
  email_sent boolean NOT NULL DEFAULT false,
  email_error text,
  error_message text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zoho_auto_import_runs TO authenticated;
GRANT ALL ON public.zoho_auto_import_runs TO service_role;

ALTER TABLE public.zoho_auto_import_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view auto import runs"
  ON public.zoho_auto_import_runs FOR SELECT TO authenticated
  USING (has_role('Super Admin') OR has_role('Admin'));

CREATE POLICY "Admins can insert auto import runs"
  ON public.zoho_auto_import_runs FOR INSERT TO authenticated
  WITH CHECK (has_role('Super Admin') OR has_role('Admin'));

CREATE POLICY "Super Admin can delete auto import runs"
  ON public.zoho_auto_import_runs FOR DELETE TO authenticated
  USING (has_role('Super Admin'));

CREATE INDEX idx_zoho_auto_import_runs_started ON public.zoho_auto_import_runs (started_at DESC);

CREATE TRIGGER trg_zoho_auto_import_runs_updated_at
  BEFORE UPDATE ON public.zoho_auto_import_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();