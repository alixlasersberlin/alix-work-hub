ALTER TABLE public.device_locks ADD COLUMN IF NOT EXISTS customer_number text;
UPDATE public.device_locks SET customer_number = customer_id WHERE customer_number IS NULL AND customer_id IS NOT NULL;