ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.production_orders REPLICA IDENTITY FULL;
ALTER TABLE public.lager_devices REPLICA IDENTITY FULL;
ALTER TABLE public.route_plans REPLICA IDENTITY FULL;
ALTER TABLE public.order_status_history REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.production_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lager_devices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.route_plans;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_status_history;