CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_sc_messages_twilio_sid
  ON public.whatsapp_sc_messages (twilio_message_sid)
  WHERE twilio_message_sid IS NOT NULL;