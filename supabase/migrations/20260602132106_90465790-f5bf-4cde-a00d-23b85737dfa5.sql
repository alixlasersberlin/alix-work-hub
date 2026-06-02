-- 1. Restrict reviews + review_email_logs SELECT to internal staff
DROP POLICY IF EXISTS reviews_select_authenticated ON public.reviews;
CREATE POLICY reviews_select_internal_staff
  ON public.reviews
  FOR SELECT
  TO authenticated
  USING (public.can_access_orders());

DROP POLICY IF EXISTS review_email_logs_select_authenticated ON public.review_email_logs;
CREATE POLICY review_email_logs_select_internal_staff
  ON public.review_email_logs
  FOR SELECT
  TO authenticated
  USING (public.can_access_orders());

-- 2. Tighten can_access_qm() to QM/Admin only
CREATE OR REPLACE FUNCTION public.can_access_qm()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_admin() OR public.has_role('QM');
$$;

-- 3. Revoke public EXECUTE on trigger function (only triggers should call it)
REVOKE EXECUTE ON FUNCTION public.clear_lager_reservation_on_delivery() FROM PUBLIC, anon, authenticated;