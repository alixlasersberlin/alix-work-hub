ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS is_vip boolean NOT NULL DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_vip boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_customers_is_vip ON public.customers(is_vip) WHERE is_vip = true;
CREATE INDEX IF NOT EXISTS idx_orders_is_vip ON public.orders(is_vip) WHERE is_vip = true;