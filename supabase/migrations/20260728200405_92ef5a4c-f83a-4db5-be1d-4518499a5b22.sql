-- Remove high-volume write-only tables from realtime publication.
-- audit_logs and ac_analytics_events are logged on nearly every request and
-- are never subscribed to in the UI. Broadcasting every insert costs CPU
-- and slows down user-facing queries (order detail, search).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='audit_logs') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.audit_logs';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='ac_analytics_events') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.ac_analytics_events';
  END IF;
END $$;

-- Faster AZ-Rechnung lookup on order detail load.
CREATE INDEX IF NOT EXISTS idx_order_documents_order_type_created
  ON public.order_documents (order_id, document_type, created_at DESC);

-- Faster deposit list on order detail load.
CREATE INDEX IF NOT EXISTS idx_order_additional_deposits_order_booking
  ON public.order_additional_deposits (order_id, booking_date);