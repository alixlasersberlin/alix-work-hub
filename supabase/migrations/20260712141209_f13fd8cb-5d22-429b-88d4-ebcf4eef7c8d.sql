
DO $$ BEGIN
  CREATE POLICY "ticket-attachments read authenticated"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'ticket-attachments');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "ticket-attachments upload authenticated"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'ticket-attachments');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
