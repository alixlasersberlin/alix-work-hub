CREATE TABLE public.lager_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number text NOT NULL UNIQUE,
  model_name text NOT NULL,
  airtable_record_id text,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lager_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read lager devices" ON public.lager_devices
  FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY "admins insert lager devices" ON public.lager_devices
  FOR INSERT TO authenticated WITH CHECK (is_admin());

CREATE POLICY "admins update lager devices" ON public.lager_devices
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "admins delete lager devices" ON public.lager_devices
  FOR DELETE TO authenticated USING (is_admin());

CREATE TRIGGER trg_lager_devices_updated_at
  BEFORE UPDATE ON public.lager_devices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_lager_devices_serial ON public.lager_devices(serial_number);
CREATE INDEX idx_lager_devices_entry_date ON public.lager_devices(entry_date DESC);