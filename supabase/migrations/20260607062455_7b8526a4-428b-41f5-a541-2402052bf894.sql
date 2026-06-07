ALTER TABLE public.mail_internal_messages
  DROP CONSTRAINT IF EXISTS mail_internal_messages_source_id_key;
ALTER TABLE public.mail_internal_messages
  ADD CONSTRAINT mail_internal_messages_source_id_key UNIQUE (source_id);