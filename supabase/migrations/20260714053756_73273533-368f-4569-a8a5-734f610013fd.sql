
-- ================================================================
-- 1) appointment_reminder_rules
-- ================================================================
CREATE TABLE public.appointment_reminder_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  event_type_id UUID REFERENCES public.esc_event_types(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.esc_departments(id) ON DELETE CASCADE,
  minutes_before INTEGER NOT NULL DEFAULT 60,
  channel TEXT NOT NULL DEFAULT 'push' CHECK (channel IN ('push','email','sms','in_app')),
  escalation_level INTEGER NOT NULL DEFAULT 0,
  repeat_interval_minutes INTEGER,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_reminder_rules TO authenticated;
GRANT ALL ON public.appointment_reminder_rules TO service_role;

ALTER TABLE public.appointment_reminder_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reminder_rules_read_all_authenticated"
ON public.appointment_reminder_rules FOR SELECT TO authenticated
USING (true);

CREATE POLICY "reminder_rules_manage_admins"
ON public.appointment_reminder_rules FOR ALL TO authenticated
USING (is_admin() OR has_role('Super Admin'::text) OR has_role('Geschäftsführung'::text))
WITH CHECK (is_admin() OR has_role('Super Admin'::text) OR has_role('Geschäftsführung'::text));

-- ================================================================
-- 2) appointment_reminders (geplante Versendungen)
-- ================================================================
CREATE TABLE public.appointment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.esc_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rule_id UUID REFERENCES public.appointment_reminder_rules(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'push',
  scheduled_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned','processing','sent','delivered','opened','failed','cancelled')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  idempotency_key TEXT NOT NULL,
  error_message TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (idempotency_key)
);

CREATE INDEX idx_appt_reminders_due
  ON public.appointment_reminders (scheduled_at) WHERE status = 'planned';
CREATE INDEX idx_appt_reminders_user
  ON public.appointment_reminders (user_id, scheduled_at DESC);
CREATE INDEX idx_appt_reminders_event
  ON public.appointment_reminders (event_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_reminders TO authenticated;
GRANT ALL ON public.appointment_reminders TO service_role;

ALTER TABLE public.appointment_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reminders_own_or_admin_select"
ON public.appointment_reminders FOR SELECT TO authenticated
USING (user_id = auth.uid() OR is_admin() OR has_role('Super Admin'::text));

CREATE POLICY "reminders_own_update"
ON public.appointment_reminders FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR is_admin() OR has_role('Super Admin'::text))
WITH CHECK (user_id = auth.uid() OR is_admin() OR has_role('Super Admin'::text));

CREATE POLICY "reminders_admin_insert"
ON public.appointment_reminders FOR INSERT TO authenticated
WITH CHECK (is_admin() OR has_role('Super Admin'::text));

CREATE POLICY "reminders_super_admin_delete"
ON public.appointment_reminders FOR DELETE TO authenticated
USING (has_role('Super Admin'::text));

-- ================================================================
-- 3) notification_preferences (pro User)
-- ================================================================
CREATE TABLE public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  sms_enabled BOOLEAN NOT NULL DEFAULT false,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT false,
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  sound_enabled BOOLEAN NOT NULL DEFAULT true,
  vibration_enabled BOOLEAN NOT NULL DEFAULT true,
  badge_enabled BOOLEAN NOT NULL DEFAULT true,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  weekend_enabled BOOLEAN NOT NULL DEFAULT true,
  privacy_mode BOOLEAN NOT NULL DEFAULT true,
  selected_event_types UUID[] NOT NULL DEFAULT '{}',
  selected_departments UUID[] NOT NULL DEFAULT '{}',
  escalations_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_prefs_own_all"
ON public.notification_preferences FOR ALL TO authenticated
USING (user_id = auth.uid() OR is_admin() OR has_role('Super Admin'::text))
WITH CHECK (user_id = auth.uid() OR is_admin() OR has_role('Super Admin'::text));

-- ================================================================
-- 4) app_notifications (In-App-Center)
-- ================================================================
CREATE TABLE public.app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  event_id UUID REFERENCES public.esc_events(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'appointment',
  title TEXT NOT NULL,
  message TEXT,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  read_at TIMESTAMPTZ,
  action_url TEXT,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_app_notif_user_unread
  ON public.app_notifications (user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX idx_app_notif_user
  ON public.app_notifications (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_notifications TO authenticated;
GRANT ALL ON public.app_notifications TO service_role;

ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_notif_own_select"
ON public.app_notifications FOR SELECT TO authenticated
USING (user_id = auth.uid() OR is_admin() OR has_role('Super Admin'::text));

CREATE POLICY "app_notif_own_update"
ON public.app_notifications FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR is_admin() OR has_role('Super Admin'::text))
WITH CHECK (user_id = auth.uid() OR is_admin() OR has_role('Super Admin'::text));

CREATE POLICY "app_notif_admin_insert"
ON public.app_notifications FOR INSERT TO authenticated
WITH CHECK (is_admin() OR has_role('Super Admin'::text));

CREATE POLICY "app_notif_own_delete"
ON public.app_notifications FOR DELETE TO authenticated
USING (user_id = auth.uid() OR has_role('Super Admin'::text));

-- ================================================================
-- updated_at Trigger
-- ================================================================
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER tg_appointment_reminder_rules_updated
  BEFORE UPDATE ON public.appointment_reminder_rules
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE TRIGGER tg_appointment_reminders_updated
  BEFORE UPDATE ON public.appointment_reminders
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE TRIGGER tg_notification_preferences_updated
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- Realtime aktivieren
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointment_reminders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_notifications;

-- ================================================================
-- Standardregeln (Seed)
-- ================================================================
INSERT INTO public.appointment_reminder_rules (name, minutes_before, channel, escalation_level, active) VALUES
  ('Standard 24h', 1440, 'push', 0, true),
  ('Standard 3h', 180, 'push', 0, true),
  ('Standard 60min', 60, 'push', 0, true),
  ('Standard 15min', 15, 'push', 1, true),
  ('Terminbeginn', 0, 'push', 2, true),
  ('Überfällig 10min', -10, 'push', 3, true);
