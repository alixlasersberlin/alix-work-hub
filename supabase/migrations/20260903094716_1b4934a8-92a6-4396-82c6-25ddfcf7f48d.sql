-- 1) Push-Geräte: bestehende Tabelle erweitern (keine Duplizierung)
ALTER TABLE public.mobile_push_subscriptions
  ADD COLUMN IF NOT EXISTS device_id text,
  ADD COLUMN IF NOT EXISTS push_provider text,
  ADD COLUMN IF NOT EXISTS notifications_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS os_version text,
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'production',
  ADD COLUMN IF NOT EXISTS last_push_ok_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_push_error text,
  ADD COLUMN IF NOT EXISTS last_push_error_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS uq_push_device_user_device
  ON public.mobile_push_subscriptions (user_id, device_id) WHERE device_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_push_dev_active
  ON public.mobile_push_subscriptions (user_id) WHERE revoked_at IS NULL AND notifications_enabled;

-- 2) Notification Preferences erweitern
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS new_messages boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS assigned_messages boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS technical_messages boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sales_messages boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS priority_p1 boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS priority_p2 boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ticket_notifications boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS preview_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS quiet_hours_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS p1_ignores_quiet_hours boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Europe/Berlin';

-- 3) Notification Events
CREATE TABLE IF NOT EXISTS public.notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_id uuid REFERENCES public.mobile_push_subscriptions(id) ON DELETE SET NULL,
  conversation_id uuid,
  message_id uuid,
  notification_type text NOT NULL,
  priority text,
  provider text,
  provider_message_id text,
  status text NOT NULL DEFAULT 'QUEUED',
  attempt integer NOT NULL DEFAULT 1,
  dedup_key text,
  title text,
  body text,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notification_events TO authenticated;
GRANT ALL ON public.notification_events TO service_role;
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ne_select_own ON public.notification_events;
CREATE POLICY ne_select_own ON public.notification_events FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS ne_update_own ON public.notification_events;
CREATE POLICY ne_update_own ON public.notification_events FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_dedup
  ON public.notification_events (dedup_key) WHERE dedup_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ne_user_created ON public.notification_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ne_conv ON public.notification_events (conversation_id);

-- 4) Eskalationsregeln
CREATE TABLE IF NOT EXISTS public.escalation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  department text,
  priority text,
  channel_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  first_reminder_minutes integer,
  second_reminder_minutes integer,
  escalate_minutes integer,
  escalate_to_role text,
  escalate_to_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.escalation_rules TO authenticated;
GRANT ALL ON public.escalation_rules TO service_role;
ALTER TABLE public.escalation_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS er_read ON public.escalation_rules;
CREATE POLICY er_read ON public.escalation_rules FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS er_admin ON public.escalation_rules;
CREATE POLICY er_admin ON public.escalation_rules FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO public.escalation_rules (name, priority, first_reminder_minutes, second_reminder_minutes, escalate_minutes, escalate_to_role)
SELECT 'Standard P1', 'P1', 5, 10, 15, 'Admin'
WHERE NOT EXISTS (SELECT 1 FROM public.escalation_rules WHERE priority = 'P1' AND department IS NULL);
INSERT INTO public.escalation_rules (name, priority, first_reminder_minutes, second_reminder_minutes, escalate_minutes, escalate_to_role)
SELECT 'Standard P2', 'P2', 15, 30, 45, 'Admin'
WHERE NOT EXISTS (SELECT 1 FROM public.escalation_rules WHERE priority = 'P2' AND department IS NULL);

-- 5) Conversation-Eskalationen
CREATE TABLE IF NOT EXISTS public.conversation_escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  rule_id uuid REFERENCES public.escalation_rules(id) ON DELETE SET NULL,
  escalation_level integer NOT NULL DEFAULT 1,
  scheduled_for timestamptz NOT NULL,
  triggered_at timestamptz,
  cancelled_at timestamptz,
  status text NOT NULL DEFAULT 'SCHEDULED',
  target_user_id uuid,
  target_role text,
  notification_event_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_escalations TO authenticated;
GRANT ALL ON public.conversation_escalations TO service_role;
ALTER TABLE public.conversation_escalations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ce_read ON public.conversation_escalations;
CREATE POLICY ce_read ON public.conversation_escalations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS ce_admin ON public.conversation_escalations;
CREATE POLICY ce_admin ON public.conversation_escalations FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE INDEX IF NOT EXISTS idx_ce_due ON public.conversation_escalations (status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_ce_conv ON public.conversation_escalations (conversation_id);

-- 6) SLA-Zeitstempel auf Conversations
ALTER TABLE public.ac_conversations
  ADD COLUMN IF NOT EXISTS first_read_at timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;