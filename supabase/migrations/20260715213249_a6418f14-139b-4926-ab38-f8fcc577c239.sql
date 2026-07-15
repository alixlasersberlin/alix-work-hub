
-- 1) lager_devices: auch delivered_order_id berücksichtigen
DROP POLICY IF EXISTS portal_customer_select_own_devices ON public.lager_devices;
CREATE POLICY portal_customer_select_own_devices ON public.lager_devices
FOR SELECT TO authenticated
USING (
  (reserved_order_id IN (SELECT id FROM public.orders WHERE customer_id = public.current_portal_customer_id()))
  OR
  (delivered_order_id IN (SELECT id FROM public.orders WHERE customer_id = public.current_portal_customer_id()))
);

-- 2) finance_contracts: Portal-Kunde darf eigene Verträge lesen
DROP POLICY IF EXISTS portal_customer_select_own_contracts ON public.finance_contracts;
CREATE POLICY portal_customer_select_own_contracts ON public.finance_contracts
FOR SELECT TO authenticated
USING (customer_id = public.current_portal_customer_id());

-- 3) customer_portal_tickets: INSERT-Policy härten (WITH CHECK)
DROP POLICY IF EXISTS cpt_insert_customer ON public.customer_portal_tickets;
CREATE POLICY cpt_insert_customer ON public.customer_portal_tickets
FOR INSERT TO authenticated
WITH CHECK (
  customer_id = public.current_portal_customer_id()
  AND created_by = auth.uid()
);

-- 4) customer_portal_tickets: UPDATE trennen — Staff frei, Kunde nur Status
DROP POLICY IF EXISTS cpt_update_staff ON public.customer_portal_tickets;
CREATE POLICY cpt_update_staff ON public.customer_portal_tickets
FOR UPDATE TO authenticated
USING (public.can_access_mail())
WITH CHECK (public.can_access_mail());

CREATE POLICY cpt_update_customer_close ON public.customer_portal_tickets
FOR UPDATE TO authenticated
USING (customer_id = public.current_portal_customer_id())
WITH CHECK (customer_id = public.current_portal_customer_id());

-- 5) customer_portal_ticket_messages: INSERT-Policy härten
DROP POLICY IF EXISTS cptm_insert ON public.customer_portal_ticket_messages;
CREATE POLICY cptm_insert ON public.customer_portal_ticket_messages
FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND (
    -- Portal-Kunde antwortet auf eigenes Ticket
    (
      from_role = 'customer'
      AND EXISTS (
        SELECT 1 FROM public.customer_portal_tickets t
        WHERE t.id = ticket_id
          AND t.customer_id = public.current_portal_customer_id()
      )
    )
    OR
    -- Interner Mitarbeiter antwortet
    (
      from_role IN ('staff','system')
      AND public.can_access_mail()
    )
  )
);
