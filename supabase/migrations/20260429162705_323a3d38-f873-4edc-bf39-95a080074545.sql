ALTER TABLE public.production_orders
  ADD COLUMN IF NOT EXISTS is_reclamation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reclamation_reason text;

CREATE INDEX IF NOT EXISTS idx_production_orders_is_reclamation
  ON public.production_orders (is_reclamation);