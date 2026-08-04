
CREATE TABLE IF NOT EXISTS public.ratenplan_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL DEFAULT 'dry_run',
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'running',
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  applied_run_id uuid,
  rolled_back_at timestamptz,
  rolled_back_by uuid
);

CREATE TABLE IF NOT EXISTS public.ratenplan_sync_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.ratenplan_sync_runs(id) ON DELETE CASCADE,
  profile_id uuid,
  order_id uuid,
  order_number text,
  customer_name text,
  document_id uuid,
  document_title text,
  document_type text,
  delivery_date date,
  delivery_source text,
  estimated boolean NOT NULL DEFAULT false,
  first_rate_old date,
  first_rate_new date,
  shifted_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  needs_review boolean NOT NULL DEFAULT false,
  reason text,
  candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ratenplan_sync_items_run ON public.ratenplan_sync_items(run_id);

CREATE TABLE IF NOT EXISTS public.ratenplan_sync_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.ratenplan_sync_runs(id) ON DELETE CASCADE,
  table_name text NOT NULL,
  record_id text NOT NULL,
  before_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ratenplan_sync_backups_run ON public.ratenplan_sync_backups(run_id);

CREATE TABLE IF NOT EXISTS public.ratenplan_document_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE,
  document_id uuid NOT NULL,
  document_type text,
  delivery_date date,
  confirmed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ratenplan_ai_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid,
  profile_id uuid,
  extracted_date date,
  corrected_date date NOT NULL,
  note text,
  corrected_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ratenplan_sync_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ratenplan_sync_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ratenplan_sync_backups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ratenplan_document_links TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ratenplan_ai_corrections TO authenticated;
GRANT ALL ON public.ratenplan_sync_runs TO service_role;
GRANT ALL ON public.ratenplan_sync_items TO service_role;
GRANT ALL ON public.ratenplan_sync_backups TO service_role;
GRANT ALL ON public.ratenplan_document_links TO service_role;
GRANT ALL ON public.ratenplan_ai_corrections TO service_role;

ALTER TABLE public.ratenplan_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratenplan_sync_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratenplan_sync_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratenplan_document_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratenplan_ai_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rp_runs_admin_rw" ON public.ratenplan_sync_runs FOR ALL TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "rp_items_admin_rw" ON public.ratenplan_sync_items FOR ALL TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "rp_backups_admin_rw" ON public.ratenplan_sync_backups FOR ALL TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "rp_links_admin_rw" ON public.ratenplan_document_links FOR ALL TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "rp_corrections_admin_rw" ON public.ratenplan_ai_corrections FOR ALL TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));
