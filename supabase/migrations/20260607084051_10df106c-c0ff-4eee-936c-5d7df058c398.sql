ALTER TABLE public.ticket_sync_logs
  ADD COLUMN IF NOT EXISTS response_code int,
  ADD COLUMN IF NOT EXISTS attempt int DEFAULT 1;

ALTER TABLE public.ticket_outbound_sync_logs
  ADD COLUMN IF NOT EXISTS response_code int,
  ADD COLUMN IF NOT EXISTS attempt int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS direction text DEFAULT 'outbound';