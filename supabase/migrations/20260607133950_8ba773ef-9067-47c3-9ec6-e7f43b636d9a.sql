
-- 1) Recreate spare_part_stock_overview with SECURITY INVOKER so it enforces caller RLS
ALTER VIEW public.spare_part_stock_overview SET (security_invoker = true);

-- 2) Hide otp_hash column from API-exposed SELECTs (defense in depth — OTP table is legacy)
REVOKE SELECT (otp_hash) ON public.otp_challenges FROM anon, authenticated;
