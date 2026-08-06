
-- Bestellwesen
CREATE TABLE public.plm_purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text,
  supplier_id uuid REFERENCES public.plm_suppliers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'entwurf',
  order_date date DEFAULT current_date,
  expected_date date,
  currency text NOT NULL DEFAULT 'EUR',
  total_net numeric NOT NULL DEFAULT 0,
  contact_email text,
  notes text,
  sent_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plm_purchase_orders TO authenticated;
GRANT ALL ON public.plm_purchase_orders TO service_role;
ALTER TABLE public.plm_purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY plm_po_sel ON public.plm_purchase_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY plm_po_ins ON public.plm_purchase_orders FOR INSERT TO authenticated WITH CHECK (plm_can_write());
CREATE POLICY plm_po_upd ON public.plm_purchase_orders FOR UPDATE TO authenticated USING (plm_can_write()) WITH CHECK (plm_can_write());
CREATE POLICY plm_po_del ON public.plm_purchase_orders FOR DELETE TO authenticated USING (has_role('Super Admin'));

CREATE TABLE public.plm_purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES public.plm_purchase_orders(id) ON DELETE CASCADE,
  part_id uuid REFERENCES public.plm_parts(id) ON DELETE SET NULL,
  description text,
  quantity numeric NOT NULL DEFAULT 1,
  unit text DEFAULT 'Stk',
  price numeric NOT NULL DEFAULT 0,
  received_quantity numeric NOT NULL DEFAULT 0,
  position_no integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plm_purchase_order_items TO authenticated;
GRANT ALL ON public.plm_purchase_order_items TO service_role;
ALTER TABLE public.plm_purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY plm_poi_sel ON public.plm_purchase_order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY plm_poi_ins ON public.plm_purchase_order_items FOR INSERT TO authenticated WITH CHECK (plm_can_write());
CREATE POLICY plm_poi_upd ON public.plm_purchase_order_items FOR UPDATE TO authenticated USING (plm_can_write()) WITH CHECK (plm_can_write());
CREATE POLICY plm_poi_del ON public.plm_purchase_order_items FOR DELETE TO authenticated USING (has_role('Super Admin'));

-- Risikomanagement ISO 14971
CREATE TABLE public.plm_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_number text,
  device_id uuid REFERENCES public.plm_devices(id) ON DELETE CASCADE,
  assembly_id uuid REFERENCES public.plm_assemblies(id) ON DELETE SET NULL,
  part_id uuid REFERENCES public.plm_parts(id) ON DELETE SET NULL,
  category text,
  hazard text NOT NULL,
  cause text,
  effect text,
  severity integer NOT NULL DEFAULT 1,
  occurrence integer NOT NULL DEFAULT 1,
  detection integer NOT NULL DEFAULT 1,
  measures text,
  residual_severity integer,
  residual_occurrence integer,
  residual_detection integer,
  acceptable boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'offen',
  responsible_user_id uuid,
  reviewed_at date,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plm_risks TO authenticated;
GRANT ALL ON public.plm_risks TO service_role;
ALTER TABLE public.plm_risks ENABLE ROW LEVEL SECURITY;
CREATE POLICY plm_risks_sel ON public.plm_risks FOR SELECT TO authenticated USING (true);
CREATE POLICY plm_risks_ins ON public.plm_risks FOR INSERT TO authenticated WITH CHECK (plm_can_write());
CREATE POLICY plm_risks_upd ON public.plm_risks FOR UPDATE TO authenticated USING (plm_can_write()) WITH CHECK (plm_can_write());
CREATE POLICY plm_risks_del ON public.plm_risks FOR DELETE TO authenticated USING (has_role('Super Admin'));

-- Prüfmittel / Kalibrierung
CREATE TABLE public.plm_gauges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gauge_number text,
  name text NOT NULL,
  gauge_type text,
  manufacturer text,
  serial_number text,
  location text,
  responsible_user_id uuid,
  calibration_interval_months integer NOT NULL DEFAULT 12,
  last_calibration date,
  next_calibration date,
  status text NOT NULL DEFAULT 'aktiv',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plm_gauges TO authenticated;
GRANT ALL ON public.plm_gauges TO service_role;
ALTER TABLE public.plm_gauges ENABLE ROW LEVEL SECURITY;
CREATE POLICY plm_gauges_sel ON public.plm_gauges FOR SELECT TO authenticated USING (true);
CREATE POLICY plm_gauges_ins ON public.plm_gauges FOR INSERT TO authenticated WITH CHECK (plm_can_write());
CREATE POLICY plm_gauges_upd ON public.plm_gauges FOR UPDATE TO authenticated USING (plm_can_write()) WITH CHECK (plm_can_write());
CREATE POLICY plm_gauges_del ON public.plm_gauges FOR DELETE TO authenticated USING (has_role('Super Admin'));

CREATE TABLE public.plm_calibrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gauge_id uuid NOT NULL REFERENCES public.plm_gauges(id) ON DELETE CASCADE,
  calibrated_at date NOT NULL DEFAULT current_date,
  next_due date,
  result text NOT NULL DEFAULT 'io',
  certificate_number text,
  provider text,
  deviation text,
  document_url text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plm_calibrations TO authenticated;
GRANT ALL ON public.plm_calibrations TO service_role;
ALTER TABLE public.plm_calibrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY plm_cal_sel ON public.plm_calibrations FOR SELECT TO authenticated USING (true);
CREATE POLICY plm_cal_ins ON public.plm_calibrations FOR INSERT TO authenticated WITH CHECK (plm_can_write());
CREATE POLICY plm_cal_upd ON public.plm_calibrations FOR UPDATE TO authenticated USING (plm_can_write()) WITH CHECK (plm_can_write());
CREATE POLICY plm_cal_del ON public.plm_calibrations FOR DELETE TO authenticated USING (has_role('Super Admin'));

-- Serien-/Chargenvergabe
CREATE TABLE public.plm_serial_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number text NOT NULL UNIQUE,
  device_id uuid REFERENCES public.plm_devices(id) ON DELETE SET NULL,
  production_order_id uuid REFERENCES public.plm_production_orders(id) ON DELETE SET NULL,
  batch_number text,
  lot_number text,
  udi_pi text,
  produced_at date DEFAULT current_date,
  status text NOT NULL DEFAULT 'produziert',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plm_serial_records TO authenticated;
GRANT ALL ON public.plm_serial_records TO service_role;
ALTER TABLE public.plm_serial_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY plm_ser_sel ON public.plm_serial_records FOR SELECT TO authenticated USING (true);
CREATE POLICY plm_ser_ins ON public.plm_serial_records FOR INSERT TO authenticated WITH CHECK (plm_can_write());
CREATE POLICY plm_ser_upd ON public.plm_serial_records FOR UPDATE TO authenticated USING (plm_can_write()) WITH CHECK (plm_can_write());
CREATE POLICY plm_ser_del ON public.plm_serial_records FOR DELETE TO authenticated USING (has_role('Super Admin'));

CREATE INDEX idx_plm_poi_po ON public.plm_purchase_order_items(po_id);
CREATE INDEX idx_plm_risks_device ON public.plm_risks(device_id);
CREATE INDEX idx_plm_cal_gauge ON public.plm_calibrations(gauge_id);
CREATE INDEX idx_plm_ser_po ON public.plm_serial_records(production_order_id);

CREATE TRIGGER trg_plm_po_upd BEFORE UPDATE ON public.plm_purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_plm_poi_upd BEFORE UPDATE ON public.plm_purchase_order_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_plm_risks_upd BEFORE UPDATE ON public.plm_risks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_plm_gauges_upd BEFORE UPDATE ON public.plm_gauges FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_plm_cal_upd BEFORE UPDATE ON public.plm_calibrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_plm_ser_upd BEFORE UPDATE ON public.plm_serial_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
