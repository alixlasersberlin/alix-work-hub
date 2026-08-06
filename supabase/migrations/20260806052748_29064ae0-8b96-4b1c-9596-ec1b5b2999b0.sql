
CREATE TABLE public.delivery_carriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  street text, zip text, city text, country text DEFAULT 'DE',
  countries text[] DEFAULT '{}',
  vat_id text,
  price_per_km numeric DEFAULT 0,
  price_per_stop numeric DEFAULT 0,
  base_fee numeric DEFAULT 0,
  rating numeric,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_carriers TO authenticated;
GRANT ALL ON public.delivery_carriers TO service_role;
ALTER TABLE public.delivery_carriers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "carriers_select" ON public.delivery_carriers FOR SELECT TO authenticated USING (true);
CREATE POLICY "carriers_insert" ON public.delivery_carriers FOR INSERT TO authenticated
  WITH CHECK (has_role('Super Admin') OR has_role('Admin') OR has_role('Tourenplanung'));
CREATE POLICY "carriers_update" ON public.delivery_carriers FOR UPDATE TO authenticated
  USING (has_role('Super Admin') OR has_role('Admin') OR has_role('Tourenplanung'));
CREATE POLICY "carriers_delete" ON public.delivery_carriers FOR DELETE TO authenticated
  USING (has_role('Super Admin'));

CREATE TABLE public.delivery_carrier_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_id uuid NOT NULL REFERENCES public.delivery_carriers(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.delivery_appointments(id) ON DELETE CASCADE,
  tour_id uuid REFERENCES public.delivery_tours(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'angefragt',
  assigned_date date,
  agreed_price numeric,
  currency text DEFAULT 'EUR',
  tracking_number text,
  pod_document_id uuid,
  pod_received_at timestamptz,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_carrier_assignments TO authenticated;
GRANT ALL ON public.delivery_carrier_assignments TO service_role;
ALTER TABLE public.delivery_carrier_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "carrier_assign_select" ON public.delivery_carrier_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "carrier_assign_insert" ON public.delivery_carrier_assignments FOR INSERT TO authenticated
  WITH CHECK (has_role('Super Admin') OR has_role('Admin') OR has_role('Tourenplanung'));
CREATE POLICY "carrier_assign_update" ON public.delivery_carrier_assignments FOR UPDATE TO authenticated
  USING (has_role('Super Admin') OR has_role('Admin') OR has_role('Tourenplanung'));
CREATE POLICY "carrier_assign_delete" ON public.delivery_carrier_assignments FOR DELETE TO authenticated
  USING (has_role('Super Admin'));
CREATE INDEX idx_carrier_assign_carrier ON public.delivery_carrier_assignments(carrier_id);
CREATE INDEX idx_carrier_assign_appt ON public.delivery_carrier_assignments(appointment_id);

CREATE TABLE public.delivery_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number text,
  return_type text NOT NULL DEFAULT 'rueckholung',
  status text NOT NULL DEFAULT 'offen',
  order_id uuid,
  order_number text,
  customer_name text,
  company_name text,
  appointment_id uuid REFERENCES public.delivery_appointments(id) ON DELETE SET NULL,
  incident_id uuid REFERENCES public.delivery_incidents(id) ON DELETE SET NULL,
  device_name text,
  serial_number text,
  replacement_device text,
  replacement_serial text,
  condition text,
  accessories text,
  reason text,
  target_location text,
  pickup_date date,
  received_at timestamptz,
  stock_booked boolean NOT NULL DEFAULT false,
  workshop_ticket_id uuid,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_returns TO authenticated;
GRANT ALL ON public.delivery_returns TO service_role;
ALTER TABLE public.delivery_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "returns_select" ON public.delivery_returns FOR SELECT TO authenticated USING (true);
CREATE POLICY "returns_insert" ON public.delivery_returns FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "returns_update" ON public.delivery_returns FOR UPDATE TO authenticated
  USING (has_role('Super Admin') OR has_role('Admin') OR has_role('Tourenplanung') OR created_by = auth.uid());
CREATE POLICY "returns_delete" ON public.delivery_returns FOR DELETE TO authenticated
  USING (has_role('Super Admin'));
CREATE INDEX idx_delivery_returns_status ON public.delivery_returns(status);

CREATE SEQUENCE IF NOT EXISTS public.delivery_return_seq START 1;
CREATE OR REPLACE FUNCTION public.assign_delivery_return_number()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.return_number IS NULL THEN
    NEW.return_number := 'RET-' || to_char(now(),'YYYY') || '-' ||
      lpad(nextval('public.delivery_return_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_delivery_return_number BEFORE INSERT ON public.delivery_returns
FOR EACH ROW EXECUTE FUNCTION public.assign_delivery_return_number();

CREATE TABLE public.delivery_tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.delivery_appointments(id) ON DELETE CASCADE,
  tour_id uuid REFERENCES public.delivery_tours(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  message text,
  eta timestamptz,
  lat numeric,
  lng numeric,
  visible_to_customer boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_tracking_events TO authenticated;
GRANT ALL ON public.delivery_tracking_events TO service_role;
ALTER TABLE public.delivery_tracking_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tracking_select" ON public.delivery_tracking_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "tracking_insert" ON public.delivery_tracking_events FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "tracking_update" ON public.delivery_tracking_events FOR UPDATE TO authenticated
  USING (has_role('Super Admin') OR has_role('Admin') OR has_role('Tourenplanung'));
CREATE POLICY "tracking_delete" ON public.delivery_tracking_events FOR DELETE TO authenticated
  USING (has_role('Super Admin'));
CREATE INDEX idx_tracking_appt ON public.delivery_tracking_events(appointment_id, created_at DESC);

CREATE TABLE public.dispatch_ai_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_date date,
  category text NOT NULL,
  title text NOT NULL,
  detail text,
  rationale text,
  impact text,
  severity text NOT NULL DEFAULT 'info',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'offen',
  handled_by uuid,
  handled_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dispatch_ai_suggestions TO authenticated;
GRANT ALL ON public.dispatch_ai_suggestions TO service_role;
ALTER TABLE public.dispatch_ai_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_sugg_select" ON public.dispatch_ai_suggestions FOR SELECT TO authenticated USING (true);
CREATE POLICY "ai_sugg_insert" ON public.dispatch_ai_suggestions FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "ai_sugg_update" ON public.dispatch_ai_suggestions FOR UPDATE TO authenticated
  USING (has_role('Super Admin') OR has_role('Admin') OR has_role('Tourenplanung'));
CREATE POLICY "ai_sugg_delete" ON public.dispatch_ai_suggestions FOR DELETE TO authenticated
  USING (has_role('Super Admin'));
CREATE INDEX idx_ai_sugg_status ON public.dispatch_ai_suggestions(status, created_at DESC);

CREATE TRIGGER trg_carriers_upd BEFORE UPDATE ON public.delivery_carriers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_carrier_assign_upd BEFORE UPDATE ON public.delivery_carrier_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_returns_upd BEFORE UPDATE ON public.delivery_returns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_tracking_upd BEFORE UPDATE ON public.delivery_tracking_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ai_sugg_upd BEFORE UPDATE ON public.dispatch_ai_suggestions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
