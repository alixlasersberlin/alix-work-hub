
-- Tighten alix_sign_signatures INSERT: only admins can directly insert via PostgREST.
-- Customer/token-based signing flows go through edge functions using service_role which bypasses RLS.
DROP POLICY IF EXISTS alix_sign_signatures_insert ON public.alix_sign_signatures;
CREATE POLICY alix_sign_signatures_insert
  ON public.alix_sign_signatures
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Document intent on ticket_sync_logs: writes only via service_role (edge functions).
-- Explicitly block INSERT/UPDATE for authenticated users.
CREATE POLICY ticket_sync_logs_block_insert
  ON public.ticket_sync_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY ticket_sync_logs_block_update
  ON public.ticket_sync_logs
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);
