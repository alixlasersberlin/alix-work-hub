ALTER TABLE public.maintenance_plans
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS serial_number text,
  ADD COLUMN IF NOT EXISTS responsible_role text,
  ADD COLUMN IF NOT EXISTS work_scope text,
  ADD COLUMN IF NOT EXISTS required_parts jsonb,
  ADD COLUMN IF NOT EXISTS estimated_duration_min integer,
  ADD COLUMN IF NOT EXISTS mandatory boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS warranty_terms text,
  ADD COLUMN IF NOT EXISTS on_site boolean DEFAULT false;

ALTER TABLE public.device_maintenance
  ADD COLUMN IF NOT EXISTS postponed_until date,
  ADD COLUMN IF NOT EXISTS route_plan_id uuid,
  ADD COLUMN IF NOT EXISTS ticket_id uuid,
  ADD COLUMN IF NOT EXISTS reminder_30d_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_14d_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_due_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_overdue_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS customer_email text,
  ADD COLUMN IF NOT EXISTS service_address jsonb;

CREATE TABLE IF NOT EXISTS public.maintenance_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_maintenance_id uuid REFERENCES public.device_maintenance(id) ON DELETE CASCADE,
  serial_number text,
  device_name text,
  customer_id uuid,
  customer_name text,
  recipient_email text NOT NULL,
  reminder_type text NOT NULL,
  due_date date,
  sent_on date NOT NULL DEFAULT current_date,
  sent_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'sent',
  error text,
  payload jsonb
);

CREATE INDEX IF NOT EXISTS idx_mrl_dm ON public.maintenance_reminder_log(device_maintenance_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_mrl_per_day
  ON public.maintenance_reminder_log(device_maintenance_id, reminder_type, sent_on);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_reminder_log TO authenticated;
GRANT ALL ON public.maintenance_reminder_log TO service_role;

ALTER TABLE public.maintenance_reminder_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "maintenance_reminder_log_read" ON public.maintenance_reminder_log;
DROP POLICY IF EXISTS "maintenance_reminder_log_write" ON public.maintenance_reminder_log;
DROP POLICY IF EXISTS "maintenance_reminder_log_delete_super" ON public.maintenance_reminder_log;

CREATE POLICY "maintenance_reminder_log_read"
  ON public.maintenance_reminder_log FOR SELECT TO authenticated
  USING (public.can_access_maintenance());

CREATE POLICY "maintenance_reminder_log_write"
  ON public.maintenance_reminder_log FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_maintenance());

CREATE POLICY "maintenance_reminder_log_delete_super"
  ON public.maintenance_reminder_log FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));