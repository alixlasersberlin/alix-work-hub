
-- Helper: write+read access
CREATE OR REPLACE FUNCTION public.can_manage_backups()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.is_admin() OR public.has_role('Geschäftsführung');
$$;

CREATE OR REPLACE FUNCTION public.can_view_backups()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.can_manage_backups() OR public.has_role('QM');
$$;

-- backup_schedules
CREATE TABLE public.backup_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  schedule_type text NOT NULL CHECK (schedule_type IN ('daily','weekly','monthly','custom')),
  cron text,
  time_of_day time,
  retention_days int NOT NULL DEFAULT 30,
  scope text NOT NULL DEFAULT 'full' CHECK (scope IN ('full','db','files','code')),
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_schedules TO authenticated;
GRANT ALL ON public.backup_schedules TO service_role;
ALTER TABLE public.backup_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view schedules" ON public.backup_schedules FOR SELECT TO authenticated USING (public.can_view_backups());
CREATE POLICY "manage schedules" ON public.backup_schedules FOR ALL TO authenticated USING (public.can_manage_backups()) WITH CHECK (public.can_manage_backups());
CREATE TRIGGER backup_schedules_updated BEFORE UPDATE ON public.backup_schedules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- backup_settings (single row k/v)
CREATE TABLE public.backup_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_settings TO authenticated;
GRANT ALL ON public.backup_settings TO service_role;
ALTER TABLE public.backup_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view settings" ON public.backup_settings FOR SELECT TO authenticated USING (public.can_view_backups());
CREATE POLICY "manage settings" ON public.backup_settings FOR ALL TO authenticated USING (public.can_manage_backups()) WITH CHECK (public.can_manage_backups());
CREATE TRIGGER backup_settings_updated BEFORE UPDATE ON public.backup_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- backup_notifications
CREATE TABLE public.backup_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('internal','email')),
  recipient text,
  status text NOT NULL DEFAULT 'pending',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_notifications TO authenticated;
GRANT ALL ON public.backup_notifications TO service_role;
ALTER TABLE public.backup_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view notif" ON public.backup_notifications FOR SELECT TO authenticated USING (public.can_view_backups());
CREATE POLICY "manage notif" ON public.backup_notifications FOR ALL TO authenticated USING (public.can_manage_backups()) WITH CHECK (public.can_manage_backups());

-- restore_jobs
CREATE TABLE public.restore_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('full','db','files','code')),
  source_backup_id uuid REFERENCES public.backups_metadata(id),
  safety_backup_id uuid REFERENCES public.backups_metadata(id),
  status text NOT NULL DEFAULT 'pending',
  requested_by uuid REFERENCES auth.users(id),
  message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restore_jobs TO authenticated;
GRANT ALL ON public.restore_jobs TO service_role;
ALTER TABLE public.restore_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view restore" ON public.restore_jobs FOR SELECT TO authenticated USING (public.can_view_backups());
CREATE POLICY "manage restore" ON public.restore_jobs FOR ALL TO authenticated USING (public.can_manage_backups()) WITH CHECK (public.can_manage_backups());
CREATE TRIGGER restore_jobs_updated BEFORE UPDATE ON public.restore_jobs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
