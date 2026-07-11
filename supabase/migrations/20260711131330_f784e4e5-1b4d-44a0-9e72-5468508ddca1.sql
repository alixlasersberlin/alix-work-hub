
DROP POLICY IF EXISTS "esc_store_appointment_kinds auth read" ON public.esc_store_appointment_kinds;
CREATE POLICY "esc_store_appointment_kinds managed read"
  ON public.esc_store_appointment_kinds
  FOR SELECT TO authenticated
  USING (public.can_manage_esc_master());

DROP POLICY IF EXISTS "esc_store_appointment_kinds auth insert" ON public.esc_store_appointment_kinds;
CREATE POLICY "esc_store_appointment_kinds managed insert"
  ON public.esc_store_appointment_kinds
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_esc_master());

DROP POLICY IF EXISTS "esc_store_appointment_kinds auth update" ON public.esc_store_appointment_kinds;
CREATE POLICY "esc_store_appointment_kinds managed update"
  ON public.esc_store_appointment_kinds
  FOR UPDATE TO authenticated
  USING (public.can_manage_esc_master())
  WITH CHECK (public.can_manage_esc_master());

DROP POLICY IF EXISTS "esc_store_appointment_kinds auth delete" ON public.esc_store_appointment_kinds;
CREATE POLICY "esc_store_appointment_kinds managed delete"
  ON public.esc_store_appointment_kinds
  FOR DELETE TO authenticated
  USING (public.can_manage_esc_master());
