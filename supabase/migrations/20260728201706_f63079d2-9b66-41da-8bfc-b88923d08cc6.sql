-- Trigram support for ILIKE searches
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- customers: 3-6 ILIKE search across company_name / contact_name
CREATE INDEX IF NOT EXISTS idx_customers_company_name_trgm
  ON public.customers USING gin (company_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_contact_name_trgm
  ON public.customers USING gin (contact_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_company_name_asc
  ON public.customers (company_name);

-- orders: sort by order_date DESC + search by order_number ILIKE
CREATE INDEX IF NOT EXISTS idx_orders_order_date_desc
  ON public.orders (order_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_orders_order_number_trgm
  ON public.orders USING gin (order_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_orders_expected_shipment_date
  ON public.orders (expected_shipment_date)
  WHERE expected_shipment_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_customer_id
  ON public.orders (customer_id);

-- offers: WHERE status NOT IN (...)
CREATE INDEX IF NOT EXISTS idx_offers_status
  ON public.offers (status);
CREATE INDEX IF NOT EXISTS idx_offers_created_at_desc
  ON public.offers (created_at DESC);

-- production_orders: many filtered counts
CREATE INDEX IF NOT EXISTS idx_production_orders_status
  ON public.production_orders (status);
CREATE INDEX IF NOT EXISTS idx_production_orders_approval_status
  ON public.production_orders (approval_status, status);
CREATE INDEX IF NOT EXISTS idx_production_orders_is_reclamation
  ON public.production_orders (is_reclamation);
CREATE INDEX IF NOT EXISTS idx_production_orders_order_id
  ON public.production_orders (order_id);

-- route_plans
CREATE INDEX IF NOT EXISTS idx_route_plans_planning_status
  ON public.route_plans (planning_status);

-- lager_devices: reservation lookup
CREATE INDEX IF NOT EXISTS idx_lager_devices_reserved_order_id
  ON public.lager_devices (reserved_order_id)
  WHERE reserved_order_id IS NOT NULL;

-- zoho_items: search + sort + status filter
CREATE INDEX IF NOT EXISTS idx_zoho_items_status_name
  ON public.zoho_items (status, name);
CREATE INDEX IF NOT EXISTS idx_zoho_items_name_trgm
  ON public.zoho_items USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_zoho_items_sku_trgm
  ON public.zoho_items USING gin (sku gin_trgm_ops);

-- zoho_invoices: raw_data @> containment
CREATE INDEX IF NOT EXISTS idx_zoho_invoices_raw_data_gin
  ON public.zoho_invoices USING gin (raw_data jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_zoho_invoices_invoice_number_trgm
  ON public.zoho_invoices USING gin (invoice_number gin_trgm_ops);

-- email_send_log
CREATE INDEX IF NOT EXISTS idx_email_send_log_created_at_desc
  ON public.email_send_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_send_log_recipient_trgm
  ON public.email_send_log USING gin (recipient_email gin_trgm_ops);

-- Refresh planner statistics
ANALYZE public.customers;
ANALYZE public.orders;
ANALYZE public.offers;
ANALYZE public.production_orders;
ANALYZE public.route_plans;
ANALYZE public.lager_devices;
ANALYZE public.zoho_items;
ANALYZE public.zoho_invoices;
ANALYZE public.email_send_log;