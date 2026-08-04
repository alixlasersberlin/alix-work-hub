-- ============ 1. RLS-Konsolidierung ============

-- tickets
DROP POLICY IF EXISTS tickets_select_tourenplanung ON public.tickets;
DROP POLICY IF EXISTS tickets_select_admin_service_technik ON public.tickets;
DROP POLICY IF EXISTS tickets_select_sachbearbeitung ON public.tickets;
DROP POLICY IF EXISTS portal_customer_select_own_tickets ON public.tickets;
DROP POLICY IF EXISTS tickets_select_finance ON public.tickets;

CREATE POLICY tickets_select_consolidated ON public.tickets
FOR SELECT TO authenticated
USING (
  (SELECT is_admin() OR has_role('Kundenservice') OR has_role('Technik') OR has_role('SACHBEARBEITUNG'))
  OR ((SELECT has_role('Finance')) AND department = 'finance')
  OR ((SELECT has_role('Tourenplanung')) AND department = ANY (ARRAY['lieferung','abholung','austausch','tourenplanung']))
  OR (customer_email IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.customers c
        WHERE c.id = (SELECT current_portal_customer_id())
          AND lower(c.email) = lower(tickets.customer_email)))
);

-- suppliers
DROP POLICY IF EXISTS "factory invoice can read suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "admins read suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "order role read suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers can read own supplier record" ON public.suppliers;

CREATE POLICY suppliers_select_consolidated ON public.suppliers
FOR SELECT TO authenticated
USING (
  (SELECT is_admin() OR can_upload_factory_invoice() OR has_role('Order'))
  OR ((SELECT is_supplier()) AND id = (SELECT current_supplier_id()))
);

-- production_order_items
DROP POLICY IF EXISTS "factory invoice can read production order items" ON public.production_order_items;
DROP POLICY IF EXISTS "admins read production order items" ON public.production_order_items;
DROP POLICY IF EXISTS "at role can read at production order items" ON public.production_order_items;
DROP POLICY IF EXISTS "sachbearbeitung read production order items" ON public.production_order_items;
DROP POLICY IF EXISTS "suppliers can read own production order items" ON public.production_order_items;
DROP POLICY IF EXISTS "order role read production order items" ON public.production_order_items;

CREATE POLICY production_order_items_select_consolidated ON public.production_order_items
FOR SELECT TO authenticated
USING (
  (SELECT is_admin() OR can_upload_factory_invoice() OR has_role('Order') OR has_role('SACHBEARBEITUNG'))
  OR ((SELECT has_role('Österreich')) AND EXISTS (
        SELECT 1 FROM public.production_orders po
        JOIN public.orders o ON o.id = po.order_id
        WHERE po.id = production_order_items.production_order_id
          AND o.source_system = 'zoho_eu_2'))
  OR ((SELECT is_supplier()) AND EXISTS (
        SELECT 1 FROM public.production_orders po
        WHERE po.id = production_order_items.production_order_id
          AND po.supplier_id = (SELECT current_supplier_id())
          AND po.approval_status = 'approved'))
);

-- esc_events
DROP POLICY IF EXISTS esc_events_dept_read ON public.esc_events;
DROP POLICY IF EXISTS esc_events_assigned_read ON public.esc_events;
DROP POLICY IF EXISTS esc_events_staff_read ON public.esc_events;
DROP POLICY IF EXISTS esc_events_ticket_events_read ON public.esc_events;

CREATE POLICY esc_events_select_consolidated ON public.esc_events
FOR SELECT TO authenticated
USING (
  deleted_at IS NULL AND (
    (SELECT esc_is_staff())
    OR assigned_user_id = (SELECT auth.uid())
    OR created_by = (SELECT auth.uid())
    OR department_id IN (SELECT esc_user_department_ids((SELECT auth.uid())))
    OR (source = 'ticket' AND (SELECT can_access_esc_module() OR has_role('Super Admin') OR has_role('Admin')))
  )
);

-- ============ 2. Dashboard-KPI-Funktionen ============

CREATE OR REPLACE FUNCTION public.finance_dashboard_kpis(_region accounting_region)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'open',        COALESCE((SELECT SUM(current_balance) FROM finance_accounts WHERE accounting_region = _region), 0),
    'overdue',     COALESCE((SELECT SUM(overdue_balance) FROM finance_accounts WHERE accounting_region = _region), 0),
    'deposits',    COALESCE((SELECT SUM(amount) FROM finance_transactions WHERE accounting_region = _region AND transaction_type = 'Anzahlung'), 0),
    'payments',    COALESCE((SELECT SUM(amount) FROM finance_transactions WHERE accounting_region = _region AND transaction_type = 'Zahlung'), 0),
    'contracts',   COALESCE((SELECT COUNT(*) FROM finance_contracts WHERE accounting_region = _region AND status = 'aktiv'), 0),
    'monthlyRates',COALESCE((SELECT SUM(monthly_rate) FROM finance_contracts WHERE accounting_region = _region AND status = 'aktiv'), 0)
  )
  WHERE can_access_finance();
$$;

REVOKE ALL ON FUNCTION public.finance_dashboard_kpis(accounting_region) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_dashboard_kpis(accounting_region) TO authenticated;

CREATE OR REPLACE FUNCTION public.mailcenter_dashboard_kpis()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH d AS (SELECT date_trunc('day', now()) AS t0)
  SELECT jsonb_build_object(
    'sentToday',      (SELECT COUNT(*) FROM mail_messages, d WHERE sent_at    >= d.t0),
    'openedToday',    (SELECT COUNT(*) FROM mail_messages, d WHERE opened_at  >= d.t0),
    'clickedToday',   (SELECT COUNT(*) FROM mail_messages, d WHERE clicked_at >= d.t0),
    'bouncedToday',   (SELECT COUNT(*) FROM mail_messages, d WHERE bounced_at >= d.t0),
    'complainedToday',(SELECT COUNT(*) FROM mail_messages, d WHERE status = 'complained' AND updated_at >= d.t0),
    'newMessages',    (SELECT COUNT(*) FROM mail_messages WHERE direction = 'inbound' AND is_read = false),
    'openRequests',   (SELECT COUNT(*) FROM mail_messages WHERE direction = 'inbound' AND assigned_to IS NULL),
    'openRepairs',    (SELECT COUNT(*) FROM repair_orders WHERE repair_status NOT ILIKE '%abgeschlossen%'),
    'critical',       (SELECT COUNT(*) FROM mail_messages WHERE priority = 'Kritisch')
  )
  WHERE can_access_mail();
$$;

REVOKE ALL ON FUNCTION public.mailcenter_dashboard_kpis() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mailcenter_dashboard_kpis() TO authenticated;

CREATE OR REPLACE FUNCTION public.ac_dashboard_kpis()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH d AS (SELECT now() - interval '7 days' AS t0)
  SELECT jsonb_build_object(
    'messages',   (SELECT COUNT(*) FROM ac_messages, d WHERE ac_messages.created_at >= d.t0),
    'convs',      (SELECT COUNT(*) FROM ac_conversations, d WHERE ac_conversations.created_at >= d.t0),
    'contacts',   (SELECT COUNT(*) FROM ac_contacts),
    'events',     (SELECT COUNT(*) FROM ac_analytics_events, d WHERE ac_analytics_events.created_at >= d.t0),
    'campaigns',  (SELECT COUNT(*) FROM ac_campaigns),
    'openInbox',  (SELECT COUNT(*) FROM ac_conversations WHERE status IN ('open','pending'))
  )
  WHERE auth.uid() IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.ac_dashboard_kpis() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ac_dashboard_kpis() TO authenticated;