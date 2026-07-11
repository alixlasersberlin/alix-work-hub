
CREATE TABLE public.esc_calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('google','microsoft')),
  account_email TEXT,
  calendar_id TEXT,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  scope TEXT,
  sync_token TEXT,
  last_sync_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, account_email)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.esc_calendar_connections TO authenticated;
GRANT ALL ON public.esc_calendar_connections TO service_role;

ALTER TABLE public.esc_calendar_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own connections" ON public.esc_calendar_connections
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role('Super Admin') OR public.has_role('Admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role('Super Admin') OR public.has_role('Admin'));

CREATE TRIGGER trg_esc_cal_conn_upd BEFORE UPDATE ON public.esc_calendar_connections
  FOR EACH ROW EXECUTE FUNCTION public.esc_touch_updated_at();

CREATE INDEX idx_esc_cal_conn_user ON public.esc_calendar_connections(user_id);

CREATE TABLE public.esc_message_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.esc_events(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email','sms','whatsapp')),
  recipient TEXT NOT NULL,
  template_key TEXT,
  subject TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  provider_message_id TEXT,
  error TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.esc_message_log TO authenticated;
GRANT ALL ON public.esc_message_log TO service_role;

ALTER TABLE public.esc_message_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read message log admins" ON public.esc_message_log
  FOR SELECT TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin'));

CREATE POLICY "insert message log auth" ON public.esc_message_log
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE TRIGGER trg_esc_msg_log_upd BEFORE UPDATE ON public.esc_message_log
  FOR EACH ROW EXECUTE FUNCTION public.esc_touch_updated_at();

CREATE INDEX idx_esc_msg_log_event ON public.esc_message_log(event_id);
