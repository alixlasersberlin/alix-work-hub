ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS fuel_type text NOT NULL DEFAULT 'diesel',
  ADD COLUMN IF NOT EXISTS consumption_per_100km numeric,
  ADD COLUMN IF NOT EXISTS co2_g_per_km numeric,
  ADD COLUMN IF NOT EXISTS cost_per_km numeric,
  ADD COLUMN IF NOT EXISTS fixed_cost_per_day numeric,
  ADD COLUMN IF NOT EXISTS telematics_provider text,
  ADD COLUMN IF NOT EXISTS telematics_device_id text,
  ADD COLUMN IF NOT EXISTS service_interval_km numeric,
  ADD COLUMN IF NOT EXISTS service_interval_months integer,
  ADD COLUMN IF NOT EXISTS last_service_km numeric,
  ADD COLUMN IF NOT EXISTS last_service_date date;

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS cost_per_hour numeric,
  ADD COLUMN IF NOT EXISTS cost_per_km numeric;

UPDATE public.vehicles SET fuel_type = 'electric' WHERE is_electric = true AND fuel_type = 'diesel';

CREATE TABLE IF NOT EXISTS public.delivery_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid REFERENCES public.delivery_appointments(id) ON DELETE CASCADE,
  tour_id uuid REFERENCES public.delivery_tours(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  token text,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  punctuality integer CHECK (punctuality BETWEEN 1 AND 5),
  friendliness integer CHECK (friendliness BETWEEN 1 AND 5),
  instruction_quality integer CHECK (instruction_quality BETWEEN 1 AND 5),
  comment text,
  customer_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.delivery_ratings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_ratings TO authenticated;
GRANT ALL ON public.delivery_ratings TO service_role;

ALTER TABLE public.delivery_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ratings_public_insert" ON public.delivery_ratings
  FOR INSERT TO anon, authenticated WITH CHECK (token IS NOT NULL);

CREATE POLICY "ratings_staff_read" ON public.delivery_ratings
  FOR SELECT TO authenticated USING (
    public.has_role('Super Admin') OR public.has_role('Admin')
    OR public.has_role('Tourenplanung') OR public.has_role('Order')
  );

CREATE POLICY "ratings_admin_manage" ON public.delivery_ratings
  FOR ALL TO authenticated USING (
    public.has_role('Super Admin') OR public.has_role('Admin')
  ) WITH CHECK (
    public.has_role('Super Admin') OR public.has_role('Admin')
  );

CREATE INDEX IF NOT EXISTS idx_delivery_ratings_tour ON public.delivery_ratings(tour_id);
CREATE INDEX IF NOT EXISTS idx_delivery_ratings_driver ON public.delivery_ratings(driver_id);

CREATE TRIGGER trg_delivery_ratings_updated
  BEFORE UPDATE ON public.delivery_ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();