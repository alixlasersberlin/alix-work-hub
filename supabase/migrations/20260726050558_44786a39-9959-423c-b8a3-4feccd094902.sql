
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram indexes for fast ILIKE '%text%' searches on customer names
CREATE INDEX IF NOT EXISTS idx_customers_company_name_trgm
  ON public.customers USING gin (company_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_contact_name_trgm
  ON public.customers USING gin (contact_name gin_trgm_ops);

-- Trigram index for fast ILIKE on order_number
CREATE INDEX IF NOT EXISTS idx_orders_order_number_trgm
  ON public.orders USING gin (order_number gin_trgm_ops);

-- GIN index for @> containment queries on zoho_invoices.raw_data
CREATE INDEX IF NOT EXISTS idx_zoho_invoices_raw_data_gin
  ON public.zoho_invoices USING gin (raw_data jsonb_path_ops);

-- Partial index for the common "open orders with deposit_ok_by" query
CREATE INDEX IF NOT EXISTS idx_orders_deposit_ok_true_by_notnull
  ON public.orders (deposit_ok_by)
  WHERE deposit_ok = true AND deposit_ok_by IS NOT NULL;

ANALYZE public.customers;
ANALYZE public.orders;
ANALYZE public.zoho_invoices;
