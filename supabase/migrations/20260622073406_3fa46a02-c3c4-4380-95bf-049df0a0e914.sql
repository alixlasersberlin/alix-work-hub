
CREATE INDEX IF NOT EXISTS idx_production_orders_is_reclamation ON public.production_orders (is_reclamation);
CREATE INDEX IF NOT EXISTS idx_production_orders_approval_status ON public.production_orders (approval_status);
CREATE INDEX IF NOT EXISTS idx_production_orders_approval_status_status ON public.production_orders (approval_status, status);
CREATE INDEX IF NOT EXISTS idx_production_orders_order_id ON public.production_orders (order_id);

CREATE INDEX IF NOT EXISTS idx_lager_devices_reserved_order_id ON public.lager_devices (reserved_order_id) WHERE reserved_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_expected_shipment_date ON public.orders (expected_shipment_date) WHERE expected_shipment_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON public.orders (order_status);
CREATE INDEX IF NOT EXISTS idx_orders_source_system ON public.orders (source_system);
CREATE INDEX IF NOT EXISTS idx_orders_deposit_ok_by ON public.orders (deposit_ok, deposit_ok_by) WHERE deposit_ok_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);

CREATE INDEX IF NOT EXISTS idx_customers_company_name ON public.customers (company_name);
CREATE INDEX IF NOT EXISTS idx_customers_source_system ON public.customers (source_system);

CREATE INDEX IF NOT EXISTS idx_zoho_items_name ON public.zoho_items (name);

CREATE INDEX IF NOT EXISTS idx_route_plans_planning_status ON public.route_plans (planning_status);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at_desc ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON public.audit_logs (module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs (user_id);

ANALYZE public.production_orders;
ANALYZE public.lager_devices;
ANALYZE public.orders;
ANALYZE public.order_items;
ANALYZE public.customers;
ANALYZE public.zoho_items;
ANALYZE public.route_plans;
ANALYZE public.audit_logs;
