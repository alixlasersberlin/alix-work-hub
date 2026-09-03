CREATE INDEX IF NOT EXISTS idx_order_items_item_name_trgm ON public.order_items USING gin (item_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_order_items_description_trgm ON public.order_items USING gin (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_order_items_sku_trgm ON public.order_items USING gin (sku gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_orders_status_customer ON public.orders (order_status, customer_id);