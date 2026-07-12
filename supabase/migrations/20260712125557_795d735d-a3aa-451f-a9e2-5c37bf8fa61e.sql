ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS follow_up_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_tickets_follow_up_at ON public.tickets(follow_up_at) WHERE follow_up_at IS NOT NULL;