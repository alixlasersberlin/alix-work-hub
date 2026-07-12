
-- 1) Move mfa_recovery_codes_hash to a dedicated, service-role-only table

CREATE TABLE IF NOT EXISTS public.user_mfa_secrets (
  user_id uuid PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  recovery_codes_hash text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- No grants to anon or authenticated: only service_role (edge functions) may touch it
GRANT ALL ON public.user_mfa_secrets TO service_role;

ALTER TABLE public.user_mfa_secrets ENABLE ROW LEVEL SECURITY;

-- Deny-all policy for authenticated/anon (defense in depth; grants already block access)
CREATE POLICY "no client access to mfa secrets"
  ON public.user_mfa_secrets
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- Backfill existing hashes
INSERT INTO public.user_mfa_secrets (user_id, recovery_codes_hash)
SELECT id, COALESCE(mfa_recovery_codes_hash, '{}')
FROM public.user_profiles
ON CONFLICT (user_id) DO NOTHING;

-- 2) Rebuild "user can update own profile" policy without the mfa_recovery_codes_hash guard
DROP POLICY IF EXISTS "user can update own profile" ON public.user_profiles;

CREATE POLICY "user can update own profile"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND NOT (supplier_id           IS DISTINCT FROM (SELECT up.supplier_id           FROM public.user_profiles up WHERE up.id = auth.uid()))
    AND NOT (account_status        IS DISTINCT FROM (SELECT up.account_status        FROM public.user_profiles up WHERE up.id = auth.uid()))
    AND NOT (is_active             IS DISTINCT FROM (SELECT up.is_active             FROM public.user_profiles up WHERE up.id = auth.uid()))
    AND NOT (invitation_status     IS DISTINCT FROM (SELECT up.invitation_status     FROM public.user_profiles up WHERE up.id = auth.uid()))
    AND NOT (password_reset_required IS DISTINCT FROM (SELECT up.password_reset_required FROM public.user_profiles up WHERE up.id = auth.uid()))
    AND NOT (department_id         IS DISTINCT FROM (SELECT up.department_id         FROM public.user_profiles up WHERE up.id = auth.uid()))
    AND NOT (otp_channel           IS DISTINCT FROM (SELECT up.otp_channel           FROM public.user_profiles up WHERE up.id = auth.uid()))
    AND NOT (mfa_enrolled_at       IS DISTINCT FROM (SELECT up.mfa_enrolled_at       FROM public.user_profiles up WHERE up.id = auth.uid()))
    AND NOT (last_otp_verified_at  IS DISTINCT FROM (SELECT up.last_otp_verified_at  FROM public.user_profiles up WHERE up.id = auth.uid()))
    AND NOT (email                 IS DISTINCT FROM (SELECT up.email                 FROM public.user_profiles up WHERE up.id = auth.uid()))
  );

-- 3) Drop the sensitive column from user_profiles entirely
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS mfa_recovery_codes_hash;

-- 4) Scope finance/zoho SELECT policies to the 'authenticated' role explicitly

DROP POLICY IF EXISTS "authorized roles can read finance records" ON public.finance_records;
CREATE POLICY "authorized roles can read finance records"
  ON public.finance_records
  FOR SELECT
  TO authenticated
  USING (can_access_finance() AND (has_role('Super Admin'::text) OR ((tenant_id IS NOT NULL) AND has_tenant_access(tenant_id))));

DROP POLICY IF EXISTS "finance can read zoho invoices" ON public.zoho_invoices;
CREATE POLICY "finance can read zoho invoices"
  ON public.zoho_invoices
  FOR SELECT
  TO authenticated
  USING (can_access_finance());

DROP POLICY IF EXISTS "finance can read zoho unpaid invoices" ON public.zoho_unpaid_invoices;
CREATE POLICY "finance can read zoho unpaid invoices"
  ON public.zoho_unpaid_invoices
  FOR SELECT
  TO authenticated
  USING (can_access_finance());

DROP POLICY IF EXISTS "finance can read recurring invoices" ON public.zoho_recurring_invoices;
CREATE POLICY "finance can read recurring invoices"
  ON public.zoho_recurring_invoices
  FOR SELECT
  TO authenticated
  USING (can_access_finance());

DROP POLICY IF EXISTS "finance can read recurring profiles" ON public.zoho_recurring_profiles;
CREATE POLICY "finance can read recurring profiles"
  ON public.zoho_recurring_profiles
  FOR SELECT
  TO authenticated
  USING (can_access_finance());
