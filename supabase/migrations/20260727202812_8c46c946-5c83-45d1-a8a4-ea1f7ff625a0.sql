
-- Fix 1: esc_store_appointments - drop overly permissive policies
DROP POLICY IF EXISTS "esc_store_appt_all_auth_read" ON public.esc_store_appointments;
DROP POLICY IF EXISTS "esc_store_appt_all_auth_insert" ON public.esc_store_appointments;
DROP POLICY IF EXISTS "esc_store_appt_all_auth_update" ON public.esc_store_appointments;

CREATE POLICY "esc_store_appointments role read"
  ON public.esc_store_appointments FOR SELECT TO authenticated
  USING (public.can_manage_esc_master() OR public.can_write_esc_operational());

CREATE POLICY "esc_store_appointments role insert"
  ON public.esc_store_appointments FOR INSERT TO authenticated
  WITH CHECK (public.can_write_esc_operational());

-- Fix 2: alixdocs-private bucket - add explicit storage policies (Admin/Super Admin only)
CREATE POLICY "alixdocs-private admin read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'alixdocs-private' AND (public.has_role('Super Admin') OR public.has_role('Admin')));

CREATE POLICY "alixdocs-private admin insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'alixdocs-private' AND (public.has_role('Super Admin') OR public.has_role('Admin')));

CREATE POLICY "alixdocs-private admin update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'alixdocs-private' AND (public.has_role('Super Admin') OR public.has_role('Admin')))
  WITH CHECK (bucket_id = 'alixdocs-private' AND (public.has_role('Super Admin') OR public.has_role('Admin')));

CREATE POLICY "alixdocs-private admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'alixdocs-private' AND public.has_role('Super Admin'));
