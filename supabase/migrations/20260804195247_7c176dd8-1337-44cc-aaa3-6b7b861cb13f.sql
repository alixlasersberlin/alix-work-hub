CREATE INDEX IF NOT EXISTS idx_route_plans_order_id ON public.route_plans (order_id);
DROP INDEX IF EXISTS public.idx_lager_devices_reserved_order;