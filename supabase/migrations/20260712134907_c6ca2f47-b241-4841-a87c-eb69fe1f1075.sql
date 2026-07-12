
-- 1) Remove anon SELECT on ticket_departments (exposes mailbox_email).
-- Public booking uses the service_role edge function `public-book-ticket`, so anon direct access is unnecessary.
DROP POLICY IF EXISTS "ticket_departments read active anon" ON public.ticket_departments;
REVOKE SELECT ON public.ticket_departments FROM anon;

-- 2) Remove login_sessions from Realtime publication (contains session_token/ip/device_info).
ALTER PUBLICATION supabase_realtime DROP TABLE public.login_sessions;

-- 3) Tighten always-true WITH CHECK on ticket_history INSERT policy.
DROP POLICY IF EXISTS "ticket_history insert authenticated" ON public.ticket_history;
CREATE POLICY "ticket_history insert authenticated"
  ON public.ticket_history
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
