-- reviews: SELECT nur für Admins + Auftragsverwaltung (vorher: alle can_access_orders())
DROP POLICY IF EXISTS reviews_select_internal_staff ON public.reviews;

CREATE POLICY reviews_select_internal_staff
  ON public.reviews
  FOR SELECT
  TO authenticated
  USING (public.is_admin() OR public.has_role('Auftragsverwaltung'));

-- review_email_logs: SELECT analog einschränken
DROP POLICY IF EXISTS review_email_logs_select_internal_staff ON public.review_email_logs;

CREATE POLICY review_email_logs_select_internal_staff
  ON public.review_email_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin() OR public.has_role('Auftragsverwaltung'));