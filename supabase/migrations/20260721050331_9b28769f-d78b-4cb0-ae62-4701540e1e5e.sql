
ALTER TABLE public.ac_calls
  ADD COLUMN IF NOT EXISTS conversation_id uuid NULL,
  ADD COLUMN IF NOT EXISTS ticket_id uuid NULL,
  ADD COLUMN IF NOT EXISTS voicemail_transcript text NULL,
  ADD COLUMN IF NOT EXISTS voicemail_transcript_status text NULL,
  ADD COLUMN IF NOT EXISTS voicemail_transcribed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS notes text NULL;

CREATE INDEX IF NOT EXISTS idx_ac_calls_wallboard
  ON public.ac_calls (status, started_at DESC)
  WHERE status IN ('ringing','in_progress','answered');

CREATE INDEX IF NOT EXISTS idx_ac_calls_conversation ON public.ac_calls (conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ac_calls_ticket ON public.ac_calls (ticket_id) WHERE ticket_id IS NOT NULL;
