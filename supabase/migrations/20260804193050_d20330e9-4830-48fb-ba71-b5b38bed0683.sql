CREATE OR REPLACE FUNCTION public.hoo_ops_kpis()
RETURNS TABLE (
  users_total bigint, users_active bigint, sessions_active bigint,
  orders_open bigint, orders_overdue bigint,
  production bigint, production_pending bigint, production_reclamation bigint,
  finance_open bigint, finance_amount_open numeric,
  tickets_open bigint, repairs_open bigint,
  routes bigint, routes_today bigint,
  lager_devices bigint, items_total bigint, stock_on_hand numeric,
  bugs_open bigint, capas_open bigint, warranty_active bigint,
  audits_24h bigint, security_incidents_24h bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*) FROM user_profiles),
    (SELECT count(*) FROM user_profiles WHERE is_active),
    (SELECT count(*) FROM login_sessions WHERE is_active AND expires_at > now()),
    (SELECT count(*) FROM orders WHERE order_status IN ('offen','Offen','open','Open','approved','Approved','invoiced','Invoiced')),
    (SELECT count(*) FROM orders WHERE expected_shipment_date IS NOT NULL AND expected_shipment_date < current_date AND coalesce(order_status,'') NOT IN ('geliefert','storniert','cancelled')),
    (SELECT count(*) FROM production_orders),
    (SELECT count(*) FROM production_orders WHERE approval_status = 'pending'),
    (SELECT count(*) FROM production_orders WHERE is_reclamation),
    (SELECT count(*) FROM finance_records WHERE payment_status = 'offen'),
    (SELECT coalesce(sum(coalesce(amount_due,0) - coalesce(amount_paid,0)),0) FROM finance_records WHERE payment_status IN ('offen','teilweise bezahlt','überfällig')),
    (SELECT count(*) FROM tickets WHERE coalesce(status,'') NOT IN ('closed','geschlossen','erledigt')),
    (SELECT count(*) FROM repair_orders WHERE coalesce(repair_status,'') NOT IN ('Abgeschlossen','abgeschlossen','Ausgeliefert','ausgeliefert','Storniert','storniert')),
    (SELECT count(*) FROM route_plans),
    (SELECT count(*) FROM route_plans WHERE planned_date >= current_date AND planned_date < current_date + 1),
    (SELECT count(*) FROM lager_devices),
    (SELECT count(*) FROM zoho_items),
    (SELECT coalesce(sum(coalesce(stock_on_hand,0)),0) FROM zoho_items),
    (SELECT count(*) FROM bugs WHERE coalesce(status,'') NOT IN ('closed','geschlossen')),
    (SELECT count(*) FROM capas WHERE coalesce(status,'') NOT IN ('closed','geschlossen')),
    (SELECT count(*) FROM warranty_records WHERE warranty_status = 'Aktiv'),
    (SELECT count(*) FROM audit_logs WHERE created_at >= now() - interval '24 hours'),
    (SELECT count(*) FROM audit_logs WHERE created_at >= now() - interval '24 hours' AND (action ILIKE '%fail%' OR action ILIKE '%denied%' OR action ILIKE '%unauthorized%' OR action ILIKE '%block%' OR action ILIKE '%suspicious%'));
$$;

REVOKE ALL ON FUNCTION public.hoo_ops_kpis() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hoo_ops_kpis() TO authenticated;