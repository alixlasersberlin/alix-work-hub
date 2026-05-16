ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS deposit_ok boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS deposit_ok_by text,
ADD COLUMN IF NOT EXISTS deposit_ok_at timestamptz;