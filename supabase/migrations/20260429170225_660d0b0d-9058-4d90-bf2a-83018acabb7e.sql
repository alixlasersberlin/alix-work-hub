ALTER TABLE public.production_orders
  DROP CONSTRAINT IF EXISTS production_orders_payment_status_check;

ALTER TABLE public.production_orders
  ADD CONSTRAINT production_orders_payment_status_check
  CHECK (payment_status IN ('Ja', 'Nein', 'Teilweise', 'Garantie'));