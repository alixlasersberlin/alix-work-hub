DROP POLICY IF EXISTS "esc_store_rm_employees managed read" ON public.esc_store_rm_employees;
CREATE POLICY "esc_store_rm_employees managed read" ON public.esc_store_rm_employees
  FOR SELECT TO authenticated USING (public.can_manage_esc_master());