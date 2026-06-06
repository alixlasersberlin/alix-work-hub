ALTER TABLE public.whatsapp_sc_messages
  ADD COLUMN IF NOT EXISTS twilio_message_sid text,
  ADD COLUMN IF NOT EXISTS receiver_phone text;

CREATE INDEX IF NOT EXISTS idx_whatsapp_sc_messages_twilio_sid
  ON public.whatsapp_sc_messages (twilio_message_sid);