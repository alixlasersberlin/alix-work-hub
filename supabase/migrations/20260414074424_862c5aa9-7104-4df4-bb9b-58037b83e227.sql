
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_external_source
ON public.customers (external_customer_id, source_system);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_number_source
ON public.orders (order_number, source_system);
