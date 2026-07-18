CREATE TABLE IF NOT EXISTS public.alixsmart_sync_state (
  entity TEXT PRIMARY KEY,
  last_cursor TEXT,
  last_synced_at TIMESTAMPTZ,
  last_status TEXT,
  last_error TEXT,
  items_processed INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.alixsmart_sync_state TO authenticated;
GRANT ALL ON public.alixsmart_sync_state TO service_role;
ALTER TABLE public.alixsmart_sync_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read sync state" ON public.alixsmart_sync_state FOR SELECT TO authenticated
  USING (has_role('Admin') OR has_role('Super Admin'));

CREATE TABLE IF NOT EXISTS public.alixsmart_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'pull',
  trigger TEXT NOT NULL DEFAULT 'cron',
  status TEXT NOT NULL DEFAULT 'running',
  items_processed INTEGER DEFAULT 0,
  items_created INTEGER DEFAULT 0,
  items_updated INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,
  error TEXT,
  meta JSONB DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_alixsmart_sync_runs_started ON public.alixsmart_sync_runs(started_at DESC);
GRANT SELECT ON public.alixsmart_sync_runs TO authenticated;
GRANT ALL ON public.alixsmart_sync_runs TO service_role;
ALTER TABLE public.alixsmart_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read sync runs" ON public.alixsmart_sync_runs FOR SELECT TO authenticated
  USING (has_role('Admin') OR has_role('Super Admin'));

CREATE TABLE IF NOT EXISTS public.alixsmart_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT UNIQUE,
  alixsmart_user_id TEXT,
  device_serial TEXT,
  event_type TEXT NOT NULL,
  event_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alixsmart_events_user ON public.alixsmart_events(alixsmart_user_id);
CREATE INDEX IF NOT EXISTS idx_alixsmart_events_serial ON public.alixsmart_events(device_serial);
CREATE INDEX IF NOT EXISTS idx_alixsmart_events_at ON public.alixsmart_events(event_at DESC);
GRANT SELECT ON public.alixsmart_events TO authenticated;
GRANT ALL ON public.alixsmart_events TO service_role;
ALTER TABLE public.alixsmart_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read events" ON public.alixsmart_events FOR SELECT TO authenticated
  USING (has_role('Admin') OR has_role('Super Admin'));

CREATE TABLE IF NOT EXISTS public.alixsmart_webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT,
  external_id TEXT,
  signature_valid BOOLEAN,
  status TEXT NOT NULL DEFAULT 'received',
  payload JSONB,
  error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alixsmart_webhook_deliveries_at ON public.alixsmart_webhook_deliveries(received_at DESC);
GRANT SELECT ON public.alixsmart_webhook_deliveries TO authenticated;
GRANT ALL ON public.alixsmart_webhook_deliveries TO service_role;
ALTER TABLE public.alixsmart_webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read webhook deliveries" ON public.alixsmart_webhook_deliveries FOR SELECT TO authenticated
  USING (has_role('Admin') OR has_role('Super Admin'));

INSERT INTO public.alixsmart_sync_state (entity) VALUES
  ('users'),('devices'),('registrations'),('events')
ON CONFLICT (entity) DO NOTHING;