-- Tighten INSERT on audit_logs: only service_role (edge functions) and the
-- SECURITY DEFINER public.log_audit_event() may write. Authenticated clients
-- can no longer write directly via the anon key.

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'public.audit_logs'::regclass
      AND polcmd IN ('a','*') -- INSERT or ALL
  LOOP
    EXECUTE format('DROP POLICY %I ON public.audit_logs', pol.polname);
  END LOOP;
END $$;

REVOKE INSERT ON public.audit_logs FROM authenticated;
REVOKE INSERT ON public.audit_logs FROM anon;
GRANT INSERT ON public.audit_logs TO service_role;

-- Explicit deny policy for clarity: no client INSERT path exists.
CREATE POLICY "no client insert on audit_logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (false);
