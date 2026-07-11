
DROP POLICY IF EXISTS "esc_store_departments managed read" ON public.esc_store_departments;
CREATE POLICY "esc_store_departments managed read" ON public.esc_store_departments
  FOR SELECT TO authenticated USING (public.can_manage_esc_master());

DROP POLICY IF EXISTS "esc_store_appointments managed read" ON public.esc_store_appointments;
CREATE POLICY "esc_store_appointments managed read" ON public.esc_store_appointments
  FOR SELECT TO authenticated USING (public.can_manage_esc_master());

DROP POLICY IF EXISTS "esc_store_employees managed read" ON public.esc_store_employees;
CREATE POLICY "esc_store_employees managed read" ON public.esc_store_employees
  FOR SELECT TO authenticated USING (public.can_manage_esc_master());

DROP POLICY IF EXISTS "esc_store_rm_absences managed read" ON public.esc_store_rm_absences;
CREATE POLICY "esc_store_rm_absences managed read" ON public.esc_store_rm_absences
  FOR SELECT TO authenticated USING (public.can_manage_esc_master());

DROP POLICY IF EXISTS "esc_store_rm_vehicles internal read" ON public.esc_store_rm_vehicles;
CREATE POLICY "esc_store_rm_vehicles internal read" ON public.esc_store_rm_vehicles
  FOR SELECT TO authenticated
  USING (public.can_manage_esc_master() OR public.can_write_esc_operational());

DROP POLICY IF EXISTS "esc_store_rm_rooms internal read" ON public.esc_store_rm_rooms;
CREATE POLICY "esc_store_rm_rooms internal read" ON public.esc_store_rm_rooms
  FOR SELECT TO authenticated
  USING (public.can_manage_esc_master() OR public.can_write_esc_operational());

DROP POLICY IF EXISTS "esc_store_rm_qualifications internal read" ON public.esc_store_rm_qualifications;
CREATE POLICY "esc_store_rm_qualifications internal read" ON public.esc_store_rm_qualifications
  FOR SELECT TO authenticated
  USING (public.can_manage_esc_master() OR public.can_write_esc_operational());

DROP POLICY IF EXISTS "esc_store_rm_maintenance internal read" ON public.esc_store_rm_maintenance;
CREATE POLICY "esc_store_rm_maintenance internal read" ON public.esc_store_rm_maintenance
  FOR SELECT TO authenticated
  USING (public.can_manage_esc_master() OR public.can_write_esc_operational());

DROP POLICY IF EXISTS "esc_store_rm_locations internal read" ON public.esc_store_rm_locations;
CREATE POLICY "esc_store_rm_locations internal read" ON public.esc_store_rm_locations
  FOR SELECT TO authenticated
  USING (public.can_manage_esc_master() OR public.can_write_esc_operational());

DROP POLICY IF EXISTS "esc_store_rm_demo_devices internal read" ON public.esc_store_rm_demo_devices;
CREATE POLICY "esc_store_rm_demo_devices internal read" ON public.esc_store_rm_demo_devices
  FOR SELECT TO authenticated
  USING (public.can_manage_esc_master() OR public.can_write_esc_operational());

DROP POLICY IF EXISTS "cpdd_insert_customer" ON public.customer_portal_document_downloads;
CREATE POLICY "cpdd_insert_customer" ON public.customer_portal_document_downloads
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = public.current_portal_customer_id()
    AND EXISTS (
      SELECT 1 FROM public.mail_attachments ma
      WHERE ma.id = customer_portal_document_downloads.attachment_id
        AND ma.customer_id = public.current_portal_customer_id()
    )
  );

DROP POLICY IF EXISTS "Authenticated can read maintenance status" ON public.system_maintenance;
CREATE POLICY "Internal staff can read maintenance status" ON public.system_maintenance
  FOR SELECT TO authenticated USING (public.is_internal_user());
