ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS billing_address jsonb DEFAULT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_address jsonb DEFAULT NULL;