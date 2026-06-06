
-- Phase 10: Wartungs- und Garantie-Automatik
-- Helper access functions
CREATE OR REPLACE FUNCTION public.can_access_maintenance()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin()
      OR public.has_role('Service')
      OR public.has_role('Serviceleitung')
      OR public.has_role('Technik')
      OR public.has_role('Kundenservice')
      OR public.has_role('Reparaturannahme')
      OR public.has_role('Finance')
      OR public.has_role('Tourenplanung')
      OR public.has_role('Vertrieb');
$$;

CREATE OR REPLACE FUNCTION public.can_manage_maintenance()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin()
      OR public.has_role('Service')
      OR public.has_role('Serviceleitung')
      OR public.has_role('Technik');
$$;

-- 1) maintenance_plans
CREATE TABLE IF NOT EXISTS public.maintenance_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_name text NOT NULL UNIQUE,
  maintenance_interval_months integer,
  maintenance_interval_hours integer,
  maintenance_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_plans TO authenticated;
GRANT ALL ON public.maintenance_plans TO service_role;
ALTER TABLE public.maintenance_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "maintenance_plans read" ON public.maintenance_plans FOR SELECT TO authenticated USING (public.can_access_maintenance());
CREATE POLICY "maintenance_plans insert" ON public.maintenance_plans FOR INSERT TO authenticated WITH CHECK (public.can_manage_maintenance());
CREATE POLICY "maintenance_plans update" ON public.maintenance_plans FOR UPDATE TO authenticated USING (public.can_manage_maintenance()) WITH CHECK (public.can_manage_maintenance());
CREATE POLICY "maintenance_plans delete" ON public.maintenance_plans FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_maintenance_plans_updated BEFORE UPDATE ON public.maintenance_plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) device_maintenance
CREATE TABLE IF NOT EXISTS public.device_maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number text NOT NULL,
  customer_id uuid,
  customer_name text,
  maintenance_plan_id uuid REFERENCES public.maintenance_plans(id) ON DELETE SET NULL,
  device_name text,
  last_maintenance_date date,
  next_maintenance_date date,
  maintenance_status text NOT NULL DEFAULT 'Geplant',
  assigned_technician uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (serial_number, maintenance_plan_id)
);
CREATE INDEX IF NOT EXISTS idx_device_maintenance_serial ON public.device_maintenance(serial_number);
CREATE INDEX IF NOT EXISTS idx_device_maintenance_next ON public.device_maintenance(next_maintenance_date);
CREATE INDEX IF NOT EXISTS idx_device_maintenance_status ON public.device_maintenance(maintenance_status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_maintenance TO authenticated;
GRANT ALL ON public.device_maintenance TO service_role;
ALTER TABLE public.device_maintenance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "device_maintenance read" ON public.device_maintenance FOR SELECT TO authenticated USING (public.can_access_maintenance());
CREATE POLICY "device_maintenance insert" ON public.device_maintenance FOR INSERT TO authenticated WITH CHECK (public.can_manage_maintenance());
CREATE POLICY "device_maintenance update" ON public.device_maintenance FOR UPDATE TO authenticated USING (public.can_manage_maintenance()) WITH CHECK (public.can_manage_maintenance());
CREATE POLICY "device_maintenance delete" ON public.device_maintenance FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_device_maintenance_updated BEFORE UPDATE ON public.device_maintenance FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) warranty_records
CREATE TABLE IF NOT EXISTS public.warranty_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number text NOT NULL UNIQUE,
  customer_id uuid,
  customer_name text,
  device_name text,
  warranty_start date,
  warranty_end date,
  warranty_type text DEFAULT 'Standard',
  warranty_status text NOT NULL DEFAULT 'Aktiv',
  warranty_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_warranty_end ON public.warranty_records(warranty_end);
CREATE INDEX IF NOT EXISTS idx_warranty_status ON public.warranty_records(warranty_status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warranty_records TO authenticated;
GRANT ALL ON public.warranty_records TO service_role;
ALTER TABLE public.warranty_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "warranty_records read" ON public.warranty_records FOR SELECT TO authenticated USING (public.can_access_maintenance());
CREATE POLICY "warranty_records insert" ON public.warranty_records FOR INSERT TO authenticated WITH CHECK (public.can_manage_maintenance());
CREATE POLICY "warranty_records update" ON public.warranty_records FOR UPDATE TO authenticated USING (public.can_manage_maintenance()) WITH CHECK (public.can_manage_maintenance());
CREATE POLICY "warranty_records delete" ON public.warranty_records FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_warranty_records_updated BEFORE UPDATE ON public.warranty_records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) warranty_claims
CREATE TABLE IF NOT EXISTS public.warranty_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number text NOT NULL,
  ticket_id uuid,
  repair_id uuid,
  claim_date date NOT NULL DEFAULT current_date,
  claim_reason text,
  approval_status text NOT NULL DEFAULT 'Offen',
  approved_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_warranty_claims_serial ON public.warranty_claims(serial_number);
CREATE INDEX IF NOT EXISTS idx_warranty_claims_status ON public.warranty_claims(approval_status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warranty_claims TO authenticated;
GRANT ALL ON public.warranty_claims TO service_role;
ALTER TABLE public.warranty_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "warranty_claims read" ON public.warranty_claims FOR SELECT TO authenticated USING (public.can_access_maintenance());
CREATE POLICY "warranty_claims insert" ON public.warranty_claims FOR INSERT TO authenticated WITH CHECK (public.can_manage_maintenance());
CREATE POLICY "warranty_claims update" ON public.warranty_claims FOR UPDATE TO authenticated USING (public.can_manage_maintenance()) WITH CHECK (public.can_manage_maintenance());
CREATE POLICY "warranty_claims delete" ON public.warranty_claims FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

-- Seed maintenance_plans (Beispiele)
INSERT INTO public.maintenance_plans (device_name, maintenance_interval_months, maintenance_description) VALUES
  ('BlueIce AI', 12, 'Jährliche Wartung BlueIce AI'),
  ('Shark Alexandrit', 12, 'Jährliche Wartung Shark Alexandrit'),
  ('EMS Revolution', 6, 'Halbjährliche Wartung EMS Revolution'),
  ('Skin Master', 12, 'Jährliche Wartung Skin Master'),
  ('CO2 Pro', 12, 'Jährliche Wartung CO2 Pro'),
  ('HIFU', 12, 'Jährliche Wartung HIFU')
ON CONFLICT (device_name) DO NOTHING;

-- Auto-create warranty + maintenance when a device gets a Verkauf/Lieferung event
CREATE OR REPLACE FUNCTION public.trg_dl_auto_warranty_maintenance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_plan_id uuid;
  v_interval_months int;
  v_default_warranty_months int := 24;
  v_start date;
BEGIN
  IF NEW.serial_number IS NULL OR length(trim(NEW.serial_number)) = 0 THEN RETURN NEW; END IF;
  IF NEW.event_type NOT IN ('Verkauf','Lieferung') THEN RETURN NEW; END IF;

  v_start := COALESCE(NEW.event_date::date, current_date);

  -- Warranty
  INSERT INTO public.warranty_records (
    serial_number, customer_id, customer_name, device_name,
    warranty_start, warranty_end, warranty_type, warranty_status
  ) VALUES (
    NEW.serial_number, NEW.customer_id, NEW.customer_name, NEW.device_name,
    v_start, (v_start + (v_default_warranty_months || ' months')::interval)::date,
    'Standard', 'Aktiv'
  )
  ON CONFLICT (serial_number) DO UPDATE SET
    customer_id = COALESCE(EXCLUDED.customer_id, public.warranty_records.customer_id),
    customer_name = COALESCE(EXCLUDED.customer_name, public.warranty_records.customer_name),
    device_name = COALESCE(EXCLUDED.device_name, public.warranty_records.device_name),
    warranty_start = COALESCE(public.warranty_records.warranty_start, EXCLUDED.warranty_start),
    warranty_end = COALESCE(public.warranty_records.warranty_end, EXCLUDED.warranty_end),
    updated_at = now();

  -- Maintenance schedule (only if a plan exists for this device_name)
  IF NEW.device_name IS NOT NULL THEN
    SELECT id, maintenance_interval_months INTO v_plan_id, v_interval_months
    FROM public.maintenance_plans
    WHERE device_name = NEW.device_name
    LIMIT 1;

    IF v_plan_id IS NOT NULL AND COALESCE(v_interval_months, 0) > 0 THEN
      INSERT INTO public.device_maintenance (
        serial_number, customer_id, customer_name, device_name,
        maintenance_plan_id, last_maintenance_date, next_maintenance_date, maintenance_status
      ) VALUES (
        NEW.serial_number, NEW.customer_id, NEW.customer_name, NEW.device_name,
        v_plan_id, NULL, (v_start + (v_interval_months || ' months')::interval)::date, 'Geplant'
      )
      ON CONFLICT (serial_number, maintenance_plan_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_dl_auto_warranty_maintenance ON public.device_lifecycle;
CREATE TRIGGER trg_dl_auto_warranty_maintenance
AFTER INSERT ON public.device_lifecycle
FOR EACH ROW EXECUTE FUNCTION public.trg_dl_auto_warranty_maintenance();

-- When a maintenance is marked completed, recompute next date and log to lifecycle
CREATE OR REPLACE FUNCTION public.trg_device_maintenance_completed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_months int;
BEGIN
  IF NEW.maintenance_status = 'Abgeschlossen'
     AND OLD.maintenance_status IS DISTINCT FROM NEW.maintenance_status THEN
    NEW.last_maintenance_date := COALESCE(NEW.last_maintenance_date, current_date);
    SELECT maintenance_interval_months INTO v_months FROM public.maintenance_plans WHERE id = NEW.maintenance_plan_id;
    IF COALESCE(v_months,0) > 0 THEN
      NEW.next_maintenance_date := (NEW.last_maintenance_date + (v_months || ' months')::interval)::date;
      NEW.maintenance_status := 'Geplant';
    END IF;

    PERFORM public.dl_upsert(
      NEW.serial_number, NEW.device_name, NEW.customer_id, NEW.customer_name,
      'Wartung', now(), 'device_maintenance', NEW.id::text,
      'Wartung abgeschlossen', NULL
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_device_maintenance_completed ON public.device_maintenance;
CREATE TRIGGER trg_device_maintenance_completed
BEFORE UPDATE ON public.device_maintenance
FOR EACH ROW EXECUTE FUNCTION public.trg_device_maintenance_completed();

-- When a warranty_claim is created, mirror into device_lifecycle as Garantie event
CREATE OR REPLACE FUNCTION public.trg_warranty_claim_to_lifecycle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_dev text; v_cust uuid; v_cust_name text;
BEGIN
  SELECT device_name, customer_id, customer_name
    INTO v_dev, v_cust, v_cust_name
  FROM public.warranty_records WHERE serial_number = NEW.serial_number;
  PERFORM public.dl_upsert(
    NEW.serial_number, v_dev, v_cust, v_cust_name,
    'Garantie', now(), 'warranty_claims', NEW.id::text,
    'Garantiefall: ' || COALESCE(NEW.claim_reason, ''), NULL
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_warranty_claim_to_lifecycle ON public.warranty_claims;
CREATE TRIGGER trg_warranty_claim_to_lifecycle
AFTER INSERT ON public.warranty_claims
FOR EACH ROW EXECUTE FUNCTION public.trg_warranty_claim_to_lifecycle();

-- Daily recompute function (also called by cron edge function)
CREATE OR REPLACE FUNCTION public.refresh_warranty_and_maintenance_status()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.warranty_records SET
    warranty_status = CASE
      WHEN warranty_end IS NULL THEN warranty_status
      WHEN warranty_end < current_date THEN 'Abgelaufen'
      WHEN warranty_end <= current_date + INTERVAL '3 months' THEN 'Läuft bald ab'
      ELSE 'Aktiv'
    END,
    updated_at = now()
  WHERE warranty_end IS NOT NULL;

  UPDATE public.device_maintenance SET
    maintenance_status = 'Überfällig',
    updated_at = now()
  WHERE next_maintenance_date IS NOT NULL
    AND next_maintenance_date < current_date
    AND maintenance_status NOT IN ('Abgeschlossen','Überfällig','In Bearbeitung');
END $$;

-- Backfill: derive warranty/maintenance for already-known devices from device_lifecycle
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (serial_number) serial_number, device_name, customer_id, customer_name, event_date, event_type
    FROM public.device_lifecycle
    WHERE event_type IN ('Verkauf','Lieferung') AND serial_number IS NOT NULL
    ORDER BY serial_number, event_date ASC
  LOOP
    INSERT INTO public.warranty_records (serial_number, customer_id, customer_name, device_name, warranty_start, warranty_end, warranty_type, warranty_status)
    VALUES (r.serial_number, r.customer_id, r.customer_name, r.device_name, r.event_date::date,
            (r.event_date::date + INTERVAL '24 months')::date, 'Standard', 'Aktiv')
    ON CONFLICT (serial_number) DO NOTHING;
  END LOOP;
END $$;

SELECT public.refresh_warranty_and_maintenance_status();
