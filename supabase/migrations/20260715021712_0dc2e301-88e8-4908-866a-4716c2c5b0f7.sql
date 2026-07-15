CREATE TABLE public.zoho_estimate_import_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL,
  source_system TEXT NOT NULL,
  estimate_id TEXT,
  estimate_number TEXT,
  status TEXT NOT NULL CHECK (status IN ('success','updated','failed','skipped')),
  error_message TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_zoho_estimate_import_logs_run ON public.zoho_estimate_import_logs(run_id, created_at DESC);
CREATE INDEX idx_zoho_estimate_import_logs_status ON public.zoho_estimate_import_logs(status, created_at DESC);
CREATE INDEX idx_zoho_estimate_import_logs_estimate ON public.zoho_estimate_import_logs(estimate_number);

GRANT SELECT ON public.zoho_estimate_import_logs TO authenticated;
GRANT ALL ON public.zoho_estimate_import_logs TO service_role;

ALTER TABLE public.zoho_estimate_import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read zoho estimate import logs"
ON public.zoho_estimate_import_logs
FOR SELECT
TO authenticated
USING (public.has_role('Admin') OR public.has_role('Super Admin'));