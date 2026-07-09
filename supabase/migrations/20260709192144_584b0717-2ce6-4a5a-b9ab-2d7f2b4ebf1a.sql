
-- 1) Remove Vertrieb from maintenance access
CREATE OR REPLACE FUNCTION public.can_access_maintenance()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.is_admin()
      OR public.has_role('Service')
      OR public.has_role('Serviceleitung')
      OR public.has_role('Technik')
      OR public.has_role('Kundenservice')
      OR public.has_role('Reparaturannahme')
      OR public.has_role('Finance')
      OR public.has_role('Tourenplanung')
      OR public.has_role('SACHBEARBEITUNG');
$$;

-- 2) ESC module: restrict reads to relevant roles instead of all internal staff
CREATE OR REPLACE FUNCTION public.can_access_esc_module()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.is_admin()
      OR public.has_role('Tourenplanung')
      OR public.has_role('Serviceleitung')
      OR public.has_role('Service')
      OR public.has_role('Technik')
      OR public.has_role('Kundenservice')
      OR public.has_role('SACHBEARBEITUNG');
$$;
GRANT EXECUTE ON FUNCTION public.can_access_esc_module() TO authenticated;

DROP POLICY IF EXISTS "esc_dept_auth_read" ON public.esc_departments;
CREATE POLICY "esc_dept_auth_read" ON public.esc_departments FOR SELECT TO authenticated
  USING (public.can_access_esc_module());

DROP POLICY IF EXISTS "esc_empdept_auth_read" ON public.esc_employee_departments;
CREATE POLICY "esc_empdept_auth_read" ON public.esc_employee_departments FOR SELECT TO authenticated
  USING (public.can_access_esc_module());

DROP POLICY IF EXISTS "esc_empset_auth_read" ON public.esc_employee_settings;
CREATE POLICY "esc_empset_auth_read" ON public.esc_employee_settings FOR SELECT TO authenticated
  USING (public.can_access_esc_module());

DROP POLICY IF EXISTS "esc_evtype_auth_read" ON public.esc_event_types;
CREATE POLICY "esc_evtype_auth_read" ON public.esc_event_types FOR SELECT TO authenticated
  USING (public.can_access_esc_module());

DROP POLICY IF EXISTS "esc_res_auth_read" ON public.esc_resources;
CREATE POLICY "esc_res_auth_read" ON public.esc_resources FOR SELECT TO authenticated
  USING (public.can_access_esc_module());

DROP POLICY IF EXISTS "esc_evres_auth_read" ON public.esc_event_resources;
CREATE POLICY "esc_evres_auth_read" ON public.esc_event_resources FOR SELECT TO authenticated
  USING (public.can_access_esc_module());

DROP POLICY IF EXISTS "esc_tpl_auth_read" ON public.esc_email_templates;
CREATE POLICY "esc_tpl_auth_read" ON public.esc_email_templates FOR SELECT TO authenticated
  USING (public.can_access_esc_module());
