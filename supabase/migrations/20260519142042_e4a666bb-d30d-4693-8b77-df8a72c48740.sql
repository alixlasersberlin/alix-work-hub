ALTER TABLE public.production_orders ALTER COLUMN order_id DROP NOT NULL;
ALTER TABLE public.production_orders ALTER COLUMN order_number DROP NOT NULL;
ALTER TABLE public.production_orders ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.production_orders ADD COLUMN IF NOT EXISTS customer_name_snapshot text;
CREATE INDEX IF NOT EXISTS idx_production_orders_customer_id ON public.production_orders(customer_id);