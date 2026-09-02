CREATE TABLE public.magic_status_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL DEFAULT 'order',
  from_status text,
  to_status text NOT NULL,
  required_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  notifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_status text,
  next_task text,
  role_permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.magic_status_workflows TO authenticated;
GRANT ALL ON public.magic_status_workflows TO service_role;
ALTER TABLE public.magic_status_workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msw_read" ON public.magic_status_workflows FOR SELECT TO authenticated USING (true);
CREATE POLICY "msw_write" ON public.magic_status_workflows FOR INSERT TO authenticated WITH CHECK (public.has_role('Super Admin'));
CREATE POLICY "msw_update" ON public.magic_status_workflows FOR UPDATE TO authenticated USING (public.has_role('Super Admin')) WITH CHECK (public.has_role('Super Admin'));
CREATE POLICY "msw_delete" ON public.magic_status_workflows FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE TABLE public.magic_status_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL DEFAULT 'order',
  order_id uuid,
  device_id uuid,
  production_order_id uuid,
  old_status text,
  new_status text,
  serial_number text,
  field_name text,
  old_value text,
  new_value text,
  user_id uuid,
  user_email text,
  actions_executed jsonb NOT NULL DEFAULT '[]'::jsonb,
  actions_failed jsonb NOT NULL DEFAULT '[]'::jsonb,
  change_reason text,
  workflow_version integer,
  source text NOT NULL DEFAULT 'magic_status',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.magic_status_log TO authenticated;
GRANT ALL ON public.magic_status_log TO service_role;
ALTER TABLE public.magic_status_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msl_read" ON public.magic_status_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "msl_insert" ON public.magic_status_log FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX idx_magic_status_log_order ON public.magic_status_log(order_id, created_at DESC);
CREATE INDEX idx_magic_status_log_serial ON public.magic_status_log(serial_number);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS magic_status text,
  ADD COLUMN IF NOT EXISTS magic_status_at timestamptz,
  ADD COLUMN IF NOT EXISTS magic_status_by uuid;

CREATE TRIGGER trg_msw_updated_at BEFORE UPDATE ON public.magic_status_workflows
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();