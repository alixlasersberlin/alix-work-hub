CREATE EXTENSION IF NOT EXISTS pg_trgm;

DROP POLICY IF EXISTS "authorized roles can read zoho items" ON public.zoho_items;
CREATE POLICY "authorized roles can read zoho items" ON public.zoho_items
FOR SELECT USING ((SELECT can_access_orders()) OR (SELECT can_access_finance()));

DROP POLICY IF EXISTS "tenant_data_scope_select" ON public.zoho_items;
CREATE POLICY "tenant_data_scope_select" ON public.zoho_items
FOR SELECT USING (
  (SELECT NOT public.tenant_scope_restricted())
  OR public.source_to_tenant_code(source_system) = ANY (ARRAY(SELECT unnest(public.user_tenant_codes())))
);

DROP POLICY IF EXISTS "tenant_data_scope_select" ON public.customers;
CREATE POLICY "tenant_data_scope_select" ON public.customers
FOR SELECT USING (
  (SELECT NOT public.tenant_scope_restricted())
  OR public.source_to_tenant_code(source_system) = ANY (ARRAY(SELECT unnest(public.user_tenant_codes())))
);

DROP POLICY IF EXISTS "tenant_data_scope_select" ON public.orders;
CREATE POLICY "tenant_data_scope_select" ON public.orders
FOR SELECT USING (
  (SELECT NOT public.tenant_scope_restricted())
  OR public.source_to_tenant_code(source_system) = ANY (ARRAY(SELECT unnest(public.user_tenant_codes())))
);

CREATE INDEX IF NOT EXISTS idx_customers_company_trgm ON public.customers USING gin (company_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_contact_trgm ON public.customers USING gin (contact_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_zoho_items_name_trgm ON public.zoho_items USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_zoho_items_sku_trgm ON public.zoho_items USING gin (sku gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_zoho_items_status_name ON public.zoho_items (status, name);
CREATE INDEX IF NOT EXISTS idx_production_orders_approval_status ON public.production_orders (approval_status, status);
CREATE INDEX IF NOT EXISTS idx_production_orders_reclamation ON public.production_orders (is_reclamation);
CREATE INDEX IF NOT EXISTS idx_production_orders_order_id ON public.production_orders (order_id);
CREATE INDEX IF NOT EXISTS idx_orders_expected_shipment ON public.orders (expected_shipment_date) WHERE expected_shipment_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_deposit_ok ON public.orders (deposit_ok, deposit_ok_by);
CREATE INDEX IF NOT EXISTS idx_zoho_invoices_region_mietkauf ON public.zoho_invoices (accounting_region, is_mietkauf, id DESC);
CREATE INDEX IF NOT EXISTS idx_route_plans_status ON public.route_plans (planning_status);
CREATE INDEX IF NOT EXISTS idx_offers_status ON public.offers (status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_email_send_log_created ON public.email_send_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lager_devices_reserved_order ON public.lager_devices (reserved_order_id);