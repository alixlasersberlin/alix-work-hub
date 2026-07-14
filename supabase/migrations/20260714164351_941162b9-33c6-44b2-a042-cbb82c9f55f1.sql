
-- Orders: sort by expected_shipment_date, filter by order_status, deposit flags
CREATE INDEX IF NOT EXISTS idx_orders_expected_shipment_date
  ON public.orders (expected_shipment_date DESC NULLS LAST)
  WHERE expected_shipment_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON public.orders (order_status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_deposit_ok_by
  ON public.orders (deposit_ok, deposit_ok_by)
  WHERE deposit_ok_by IS NOT NULL;

-- Order items lookup by order_id (LATERAL join)
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);

-- Audit logs: sorted by created_at desc, filtered by module/action
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON public.audit_logs (module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs (user_id);

-- Production orders: filters is_reclamation, approval_status+status, join by order_id
CREATE INDEX IF NOT EXISTS idx_production_orders_is_reclamation ON public.production_orders (is_reclamation);
CREATE INDEX IF NOT EXISTS idx_production_orders_approval_status_status ON public.production_orders (approval_status, status);
CREATE INDEX IF NOT EXISTS idx_production_orders_order_id ON public.production_orders (order_id);

-- Route plans: filter by planning_status
CREATE INDEX IF NOT EXISTS idx_route_plans_planning_status ON public.route_plans (planning_status);

-- Zoho items: sort by name, filter by status
CREATE INDEX IF NOT EXISTS idx_zoho_items_status_name ON public.zoho_items (status, name);
CREATE INDEX IF NOT EXISTS idx_zoho_items_name ON public.zoho_items (name);

-- Customers: sort by company_name
CREATE INDEX IF NOT EXISTS idx_customers_company_name ON public.customers (company_name);

-- Lager devices: filter reserved_order_id not null
CREATE INDEX IF NOT EXISTS idx_lager_devices_reserved_order_id
  ON public.lager_devices (reserved_order_id)
  WHERE reserved_order_id IS NOT NULL;

ANALYZE public.orders;
ANALYZE public.order_items;
ANALYZE public.audit_logs;
ANALYZE public.production_orders;
ANALYZE public.route_plans;
ANALYZE public.zoho_items;
ANALYZE public.customers;
ANALYZE public.lager_devices;
