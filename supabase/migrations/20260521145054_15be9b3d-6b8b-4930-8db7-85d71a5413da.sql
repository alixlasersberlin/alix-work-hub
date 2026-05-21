
-- 1. MFA recovery code hashes: revoke column-level read from clients.
REVOKE SELECT (mfa_recovery_codes_hash) ON public.user_profiles FROM authenticated;
REVOKE SELECT (mfa_recovery_codes_hash) ON public.user_profiles FROM anon;
-- Also block client-side writes to this column (edge functions use service_role and bypass this).
REVOKE UPDATE (mfa_recovery_codes_hash), INSERT (mfa_recovery_codes_hash) ON public.user_profiles FROM authenticated;
REVOKE UPDATE (mfa_recovery_codes_hash), INSERT (mfa_recovery_codes_hash) ON public.user_profiles FROM anon;

-- 2. Customers: replace public-role SELECT policies with authenticated-only equivalents.
DROP POLICY IF EXISTS "Users see own created customers" ON public.customers;
DROP POLICY IF EXISTS "Users see own customers" ON public.customers;
DROP POLICY IF EXISTS "Users see own data" ON public.customers;

CREATE POLICY "Users see own created customers"
  ON public.customers FOR SELECT
  TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Users see own customers"
  ON public.customers FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. Audit logs: explicitly forbid DELETE for all client roles.
CREATE POLICY "no one can delete audit logs"
  ON public.audit_logs FOR DELETE
  TO authenticated
  USING (false);
