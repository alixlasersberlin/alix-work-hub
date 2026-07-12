
CREATE OR REPLACE FUNCTION public.can_read_ticket(_ticket_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = _ticket_id
      AND (
        public.is_admin()
        OR public.has_role('Super Admin')
        OR public.has_role('Kundenservice')
        OR public.has_role('Technik')
        OR public.has_role('SACHBEARBEITUNG')
        OR (public.has_role('Finance') AND t.department = 'finance')
        OR (public.has_role('Tourenplanung') AND t.department = ANY (ARRAY['lieferung','abholung','austausch','tourenplanung']))
        OR (
          t.customer_email IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.customers c
            WHERE c.id = public.current_portal_customer_id()
              AND lower(c.email) = lower(t.customer_email)
          )
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_read_ticket(uuid) TO authenticated, anon;

DROP POLICY IF EXISTS "ticket_history read authenticated" ON public.ticket_history;
CREATE POLICY "ticket_history read scoped"
  ON public.ticket_history FOR SELECT TO authenticated
  USING (public.can_read_ticket(ticket_id));

DROP POLICY IF EXISTS "ticket_history insert authenticated" ON public.ticket_history;
CREATE POLICY "ticket_history insert scoped"
  ON public.ticket_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND public.can_read_ticket(ticket_id));

DROP POLICY IF EXISTS "ticket_participants read authenticated" ON public.ticket_participants;
CREATE POLICY "ticket_participants read scoped"
  ON public.ticket_participants FOR SELECT TO authenticated
  USING (public.can_read_ticket(ticket_id));

DROP POLICY IF EXISTS "ticket_participants insert authenticated" ON public.ticket_participants;
CREATE POLICY "ticket_participants insert scoped"
  ON public.ticket_participants FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND public.can_read_ticket(ticket_id));

DROP POLICY IF EXISTS "ticket_participants update authenticated" ON public.ticket_participants;
CREATE POLICY "ticket_participants update scoped"
  ON public.ticket_participants FOR UPDATE TO authenticated
  USING (public.can_read_ticket(ticket_id))
  WITH CHECK (public.can_read_ticket(ticket_id));

INSERT INTO public.security_audit_findings (category, target, severity, title, detail, recommendation, status)
VALUES (
  'rls',
  'ticket_history, ticket_participants',
  'medium',
  'Phase 2: Ticket-Scope-Policies aktiv',
  'Die vorher offenen SELECT-Policies (USING true) auf ticket_history und ticket_participants wurden durch can_read_ticket() ersetzt. INSERT/UPDATE ebenfalls gescopet.',
  'Regelmäßig prüfen, dass neue Policies weiterhin can_read_ticket() nutzen.',
  'resolved'
);
