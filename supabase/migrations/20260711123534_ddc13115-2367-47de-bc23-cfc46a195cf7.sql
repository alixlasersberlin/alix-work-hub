
-- Fix 1: customer_portal_document_downloads - verify attachment ownership
DROP POLICY IF EXISTS cpdd_insert_customer ON public.customer_portal_document_downloads;
CREATE POLICY cpdd_insert_customer ON public.customer_portal_document_downloads
  FOR INSERT
  WITH CHECK (
    customer_id = current_portal_customer_id()
    AND EXISTS (
      SELECT 1 FROM public.mail_attachments ma
      WHERE ma.id = customer_portal_document_downloads.attachment_id
        AND ma.customer_id = current_portal_customer_id()
    )
  );

-- Fix 2 & 3: Restrict SELECT on ESC store tables to management/HR roles instead of any internal user
DROP POLICY IF EXISTS "esc_store_employees internal read" ON public.esc_store_employees;
CREATE POLICY "esc_store_employees managed read" ON public.esc_store_employees
  FOR SELECT USING (can_manage_esc_master());

DROP POLICY IF EXISTS "esc_store_departments internal read" ON public.esc_store_departments;
CREATE POLICY "esc_store_departments managed read" ON public.esc_store_departments
  FOR SELECT USING (can_manage_esc_master());

DROP POLICY IF EXISTS "esc_store_appointments internal read" ON public.esc_store_appointments;
CREATE POLICY "esc_store_appointments managed read" ON public.esc_store_appointments
  FOR SELECT USING (can_write_esc_operational());

DROP POLICY IF EXISTS "esc_store_rm_employees internal read" ON public.esc_store_rm_employees;
CREATE POLICY "esc_store_rm_employees managed read" ON public.esc_store_rm_employees
  FOR SELECT USING (can_manage_esc_master());

DROP POLICY IF EXISTS "esc_store_rm_absences internal read" ON public.esc_store_rm_absences;
CREATE POLICY "esc_store_rm_absences managed read" ON public.esc_store_rm_absences
  FOR SELECT USING (can_manage_esc_master());
