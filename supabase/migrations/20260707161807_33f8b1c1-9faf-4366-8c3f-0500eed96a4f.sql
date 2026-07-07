
-- Restrict finance table policies to authenticated role
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname FROM pg_policies
     WHERE schemaname='public'
       AND tablename IN ('finance_bank_accounts','finance_documents','finance_purchase_orders','finance_incoming_invoices','finance_assets','finance_sepa_runs','finance_liquidity_entries','finance_journal','finance_transactions')
       AND 'public' = ANY(roles)
  LOOP
    EXECUTE format('ALTER POLICY %I ON public.%I TO authenticated', r.policyname, r.tablename);
  END LOOP;
END $$;

-- customer_portal_tickets: add WITH CHECK to cpt_update_staff and trigger to lock assigned_to for portal customers
DROP POLICY IF EXISTS cpt_update_staff ON public.customer_portal_tickets;
CREATE POLICY cpt_update_staff ON public.customer_portal_tickets
  FOR UPDATE TO authenticated
  USING (can_access_mail() OR (customer_id = current_portal_customer_id()))
  WITH CHECK (can_access_mail() OR (customer_id = current_portal_customer_id()));

CREATE OR REPLACE FUNCTION public.cpt_guard_portal_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.can_access_mail() THEN
    RETURN NEW;
  END IF;
  IF NEW.customer_id IS DISTINCT FROM OLD.customer_id
     OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    RAISE EXCEPTION 'Portal customers cannot modify customer_id or assigned_to';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cpt_guard_portal_updates ON public.customer_portal_tickets;
CREATE TRIGGER trg_cpt_guard_portal_updates
  BEFORE UPDATE ON public.customer_portal_tickets
  FOR EACH ROW EXECUTE FUNCTION public.cpt_guard_portal_updates();
