
DROP POLICY IF EXISTS "delete superadmin only" ON public.esc_store_appointments;
CREATE POLICY "delete superadmin only"
  ON public.esc_store_appointments
  FOR DELETE
  TO authenticated
  USING (has_role('Super Admin'::text));
