-- Tighten ESC module SELECT policies to exclude customer portal users
DROP POLICY IF EXISTS "esc_dept_auth_read" ON public.esc_departments;
CREATE POLICY "esc_dept_auth_read" ON public.esc_departments FOR SELECT TO authenticated
  USING (NOT public.is_portal_customer());

DROP POLICY IF EXISTS "esc_empdept_auth_read" ON public.esc_employee_departments;
CREATE POLICY "esc_empdept_auth_read" ON public.esc_employee_departments FOR SELECT TO authenticated
  USING (NOT public.is_portal_customer());

DROP POLICY IF EXISTS "esc_empset_auth_read" ON public.esc_employee_settings;
CREATE POLICY "esc_empset_auth_read" ON public.esc_employee_settings FOR SELECT TO authenticated
  USING (NOT public.is_portal_customer());

DROP POLICY IF EXISTS "esc_evtype_auth_read" ON public.esc_event_types;
CREATE POLICY "esc_evtype_auth_read" ON public.esc_event_types FOR SELECT TO authenticated
  USING (NOT public.is_portal_customer());

DROP POLICY IF EXISTS "esc_res_auth_read" ON public.esc_resources;
CREATE POLICY "esc_res_auth_read" ON public.esc_resources FOR SELECT TO authenticated
  USING (NOT public.is_portal_customer());

DROP POLICY IF EXISTS "esc_evres_auth_read" ON public.esc_event_resources;
CREATE POLICY "esc_evres_auth_read" ON public.esc_event_resources FOR SELECT TO authenticated
  USING (NOT public.is_portal_customer());

DROP POLICY IF EXISTS "esc_tpl_auth_read" ON public.esc_email_templates;
CREATE POLICY "esc_tpl_auth_read" ON public.esc_email_templates FOR SELECT TO authenticated
  USING (NOT public.is_portal_customer());

-- Restrict mail_internal_messages update policy to authenticated role explicitly
DO $$
DECLARE
  v_using text;
  v_check text;
BEGIN
  SELECT pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid)
    INTO v_using, v_check
  FROM pg_policy
  WHERE polname = 'internal_msg_update'
    AND polrelid = 'public.mail_internal_messages'::regclass;

  IF v_using IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "internal_msg_update" ON public.mail_internal_messages';
    EXECUTE format(
      'CREATE POLICY "internal_msg_update" ON public.mail_internal_messages FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',
      v_using,
      COALESCE(v_check, v_using)
    );
  END IF;
END $$;