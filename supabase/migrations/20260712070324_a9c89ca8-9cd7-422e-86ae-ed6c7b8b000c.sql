
-- 1. Repair role: replace broad customer read with a scoped policy (only customers with a linked repair order)
DROP POLICY IF EXISTS "repair role can read customers" ON public.customers;

CREATE POLICY "repair role can read linked repair customers"
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (
    can_access_repair()
    AND EXISTS (
      SELECT 1 FROM public.repair_orders ro
       WHERE ro.customer_id = customers.id
    )
  );

-- 2. OTP challenges: users must not read their own hash. Verification runs server-side (edge functions / service_role).
DROP POLICY IF EXISTS "user can read own otp challenges" ON public.otp_challenges;
