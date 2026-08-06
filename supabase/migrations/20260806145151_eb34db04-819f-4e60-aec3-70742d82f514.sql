ALTER TABLE public.delivery_carrier_assignments
  ADD COLUMN IF NOT EXISTS route_plan_id uuid REFERENCES public.route_plans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dca_route_plan_id ON public.delivery_carrier_assignments(route_plan_id);