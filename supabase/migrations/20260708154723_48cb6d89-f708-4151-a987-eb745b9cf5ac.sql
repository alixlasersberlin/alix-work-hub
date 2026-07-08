CREATE UNIQUE INDEX IF NOT EXISTS uq_production_orders_one_regular_per_order
ON public.production_orders (order_id)
WHERE is_reclamation = false AND order_id IS NOT NULL;