
DROP POLICY IF EXISTS "ticket-attachments read authenticated" ON storage.objects;
DROP POLICY IF EXISTS "ticket-attachments upload authenticated" ON storage.objects;

CREATE POLICY "ticket-attachments read scoped"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'ticket-attachments'
    AND (
      public.is_admin()
      OR public.can_manage_tickets()
      OR (
        (storage.foldername(name))[1] = 'portal'
        AND public.current_portal_customer_id() IS NOT NULL
        AND (storage.foldername(name))[2] = public.current_portal_customer_id()::text
      )
    )
  );

CREATE POLICY "ticket-attachments upload scoped"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ticket-attachments'
    AND (
      public.is_admin()
      OR public.can_manage_tickets()
      OR (
        (storage.foldername(name))[1] = 'portal'
        AND public.current_portal_customer_id() IS NOT NULL
        AND (storage.foldername(name))[2] = public.current_portal_customer_id()::text
      )
    )
  );

CREATE POLICY "ticket-attachments update scoped"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'ticket-attachments'
    AND (public.is_admin() OR public.can_manage_tickets())
  )
  WITH CHECK (
    bucket_id = 'ticket-attachments'
    AND (public.is_admin() OR public.can_manage_tickets())
  );

CREATE POLICY "ticket-attachments delete scoped"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'ticket-attachments'
    AND (public.is_admin() OR public.can_manage_tickets())
  );
