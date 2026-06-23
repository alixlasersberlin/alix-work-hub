ALTER TABLE public.email_send_log DROP CONSTRAINT IF EXISTS email_send_log_source_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS email_send_log_source_id_recipient_key
  ON public.email_send_log (source_id, recipient_email);