
CREATE TABLE public.migration_backup_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id text NOT NULL,
  wave int NOT NULL,
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms bigint,
  storage_path text,
  tables jsonb NOT NULL DEFAULT '[]'::jsonb,
  row_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_rows bigint NOT NULL DEFAULT 0,
  size_bytes bigint NOT NULL DEFAULT 0,
  error_message text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.migration_backup_logs TO authenticated;
GRANT ALL ON public.migration_backup_logs TO service_role;

ALTER TABLE public.migration_backup_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read migration backup logs"
  ON public.migration_backup_logs FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE INDEX idx_migration_backup_logs_batch_id ON public.migration_backup_logs (batch_id);
CREATE INDEX idx_migration_backup_logs_wave ON public.migration_backup_logs (wave, created_at DESC);
