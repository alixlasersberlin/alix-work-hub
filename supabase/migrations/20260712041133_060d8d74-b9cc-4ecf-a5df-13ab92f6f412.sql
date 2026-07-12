
-- 1) customer_portal_users: add WITH CHECK to update policy
DROP POLICY IF EXISTS cpu_admin_manage_update ON public.customer_portal_users;
CREATE POLICY cpu_admin_manage_update
ON public.customer_portal_users
FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- 2) mail_domains: restrict credential access to Super Admin only
DROP POLICY IF EXISTS mail_domains_select ON public.mail_domains;
DROP POLICY IF EXISTS mail_domains_insert ON public.mail_domains;
DROP POLICY IF EXISTS mail_domains_update ON public.mail_domains;
DROP POLICY IF EXISTS mail_domains_delete ON public.mail_domains;

CREATE POLICY mail_domains_select ON public.mail_domains
FOR SELECT TO authenticated
USING (has_role('Super Admin'));

CREATE POLICY mail_domains_insert ON public.mail_domains
FOR INSERT TO authenticated
WITH CHECK (has_role('Super Admin'));

CREATE POLICY mail_domains_update ON public.mail_domains
FOR UPDATE TO authenticated
USING (has_role('Super Admin'))
WITH CHECK (has_role('Super Admin'));

CREATE POLICY mail_domains_delete ON public.mail_domains
FOR DELETE TO authenticated
USING (has_role('Super Admin'));

-- 3) sms_settings: restrict to Super Admin only
DROP POLICY IF EXISTS "sms_settings admin all" ON public.sms_settings;
CREATE POLICY "sms_settings super admin all" ON public.sms_settings
FOR ALL TO authenticated
USING (has_role('Super Admin'))
WITH CHECK (has_role('Super Admin'));

-- 4) Remove order_items and system_maintenance from supabase_realtime publication
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['order_items','system_maintenance'] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
