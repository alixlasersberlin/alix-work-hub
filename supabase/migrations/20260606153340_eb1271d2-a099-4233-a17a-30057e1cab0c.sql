DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT polname FROM pg_policy
     WHERE polrelid = 'public.mail_audit_logs'::regclass
       AND polcmd = 'a'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.mail_audit_logs', pol.polname);
  END LOOP;
END $$;

CREATE POLICY "Only admins can insert mail audit logs"
  ON public.mail_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());