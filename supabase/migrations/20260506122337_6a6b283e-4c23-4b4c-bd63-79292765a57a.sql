ALTER TABLE public.lager_devices
  ADD COLUMN IF NOT EXISTS reserved_order_id uuid;

CREATE INDEX IF NOT EXISTS idx_lager_devices_reserved_order
  ON public.lager_devices(reserved_order_id);