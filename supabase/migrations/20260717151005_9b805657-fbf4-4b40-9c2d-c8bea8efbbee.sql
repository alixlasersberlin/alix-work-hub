
-- Fix tautological check on customer_portal_offer_acceptances INSERT policy
DROP POLICY IF EXISTS cpoa_insert_own ON public.customer_portal_offer_acceptances;
CREATE POLICY cpoa_insert_own ON public.customer_portal_offer_acceptances
FOR INSERT TO authenticated
WITH CHECK (
  customer_id = public.current_portal_customer_id()
  AND auth_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.offers o
    WHERE o.id = customer_portal_offer_acceptances.offer_id
      AND o.customer_id = customer_portal_offer_acceptances.customer_id
      AND o.customer_visible = true
  )
);

-- Tighten sig_facsimile_log INSERT policy (was WITH CHECK true)
DROP POLICY IF EXISTS facsimile_log_insert_auth ON public.sig_facsimile_log;
CREATE POLICY facsimile_log_insert_auth ON public.sig_facsimile_log
FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND (applied_by = auth.uid() OR applied_by IS NULL));
