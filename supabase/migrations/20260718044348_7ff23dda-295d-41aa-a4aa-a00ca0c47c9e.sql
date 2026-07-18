
CREATE TABLE IF NOT EXISTS public.orders_inbox (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_system TEXT,
  external_id TEXT,
  idempotency_key TEXT UNIQUE,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'received',
  error TEXT,
  processed_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.orders_inbox TO authenticated;
GRANT ALL ON public.orders_inbox TO service_role;
ALTER TABLE public.orders_inbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read orders_inbox" ON public.orders_inbox
  FOR SELECT TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE INDEX IF NOT EXISTS idx_orders_inbox_status ON public.orders_inbox(status);
CREATE INDEX IF NOT EXISTS idx_orders_inbox_source ON public.orders_inbox(source_system, external_id);
