ALTER TABLE public.order_delivery_status
  ADD COLUMN IF NOT EXISTS customer_response text,
  ADD COLUMN IF NOT EXISTS customer_responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS customer_response_note text,
  ADD COLUMN IF NOT EXISTS customer_alternative_date date,
  ADD COLUMN IF NOT EXISTS notify_sms boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_phone text;