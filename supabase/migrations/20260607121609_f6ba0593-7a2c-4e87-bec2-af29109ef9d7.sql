
-- Erweiterung warranty_records (additiv)
ALTER TABLE public.warranty_records
  ADD COLUMN IF NOT EXISTS manufacturer text,
  ADD COLUMN IF NOT EXISTS warranty_terms text;

-- Helper functions
CREATE OR REPLACE FUNCTION public.can_access_warranty()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.is_admin()
      OR public.has_role('Service')
      OR public.has_role('Serviceleitung')
      OR public.has_role('Technik')
      OR public.has_role('Reparaturannahme')
      OR public.has_role('Finance')
      OR public.has_role('Tourenplanung')
      OR public.has_role('Kundenservice');
$$;

CREATE OR REPLACE FUNCTION public.can_manage_warranty()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.is_admin()
      OR public.has_role('Service')
      OR public.has_role('Serviceleitung')
      OR public.has_role('Technik')
      OR public.has_role('Reparaturannahme');
$$;

CREATE OR REPLACE FUNCTION public.can_approve_warranty()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.is_admin() OR public.has_role('Serviceleitung');
$$;

-- 1. warranty_decisions
CREATE TABLE IF NOT EXISTS public.warranty_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number text,
  device_name text,
  customer_id uuid,
  customer_name text,
  source_type text NOT NULL CHECK (source_type IN ('ticket','repair_order','maintenance','service_visit','other')),
  ticket_id uuid,
  repair_order_id uuid,
  maintenance_id uuid,
  warranty_record_id uuid REFERENCES public.warranty_records(id) ON DELETE SET NULL,
  check_result text CHECK (check_result IN ('Garantie','Kulanz','Kostenpflichtig','Offen')) DEFAULT 'Offen',
  decision text CHECK (decision IN (
    'Offen','Garantie genehmigt','Garantie abgelehnt',
    'Kulanz genehmigt','Kulanz teilweise genehmigt','Kostenpflichtig'
  )) DEFAULT 'Offen',
  decision_reason text,
  cost_coverage_company numeric(12,2) DEFAULT 0,
  cost_coverage_customer numeric(12,2) DEFAULT 0,
  total_cost numeric(12,2) DEFAULT 0,
  notes text,
  decided_by uuid,
  decided_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.warranty_decisions TO authenticated;
GRANT DELETE ON public.warranty_decisions TO authenticated;
GRANT ALL ON public.warranty_decisions TO service_role;
ALTER TABLE public.warranty_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "warranty_decisions_read" ON public.warranty_decisions FOR SELECT TO authenticated USING (public.can_access_warranty());
CREATE POLICY "warranty_decisions_insert" ON public.warranty_decisions FOR INSERT TO authenticated WITH CHECK (public.can_manage_warranty());
CREATE POLICY "warranty_decisions_update" ON public.warranty_decisions FOR UPDATE TO authenticated USING (public.can_manage_warranty()) WITH CHECK (public.can_manage_warranty());
CREATE POLICY "warranty_decisions_delete" ON public.warranty_decisions FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE INDEX IF NOT EXISTS idx_wd_serial ON public.warranty_decisions(serial_number);
CREATE INDEX IF NOT EXISTS idx_wd_repair ON public.warranty_decisions(repair_order_id);
CREATE INDEX IF NOT EXISTS idx_wd_ticket ON public.warranty_decisions(ticket_id);
CREATE TRIGGER trg_wd_updated_at BEFORE UPDATE ON public.warranty_decisions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. goodwill_cases
CREATE TABLE IF NOT EXISTS public.goodwill_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warranty_decision_id uuid REFERENCES public.warranty_decisions(id) ON DELETE CASCADE,
  serial_number text,
  customer_id uuid,
  customer_name text,
  reason text,
  responsible_user uuid,
  cost_share_company numeric(12,2) DEFAULT 0,
  cost_share_customer numeric(12,2) DEFAULT 0,
  requires_approval boolean DEFAULT true,
  approval_status text CHECK (approval_status IN ('Offen','Genehmigt','Abgelehnt','Teilweise')) DEFAULT 'Offen',
  approved_by uuid,
  approved_at timestamptz,
  approval_note text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goodwill_cases TO authenticated;
GRANT ALL ON public.goodwill_cases TO service_role;
ALTER TABLE public.goodwill_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goodwill_read" ON public.goodwill_cases FOR SELECT TO authenticated USING (public.can_access_warranty());
CREATE POLICY "goodwill_insert" ON public.goodwill_cases FOR INSERT TO authenticated WITH CHECK (public.can_manage_warranty());
CREATE POLICY "goodwill_update" ON public.goodwill_cases FOR UPDATE TO authenticated USING (public.can_manage_warranty()) WITH CHECK (public.can_manage_warranty());
CREATE POLICY "goodwill_delete" ON public.goodwill_cases FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_gw_updated_at BEFORE UPDATE ON public.goodwill_cases FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. loaner_device_assignments
CREATE TABLE IF NOT EXISTS public.loaner_device_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lager_device_id uuid REFERENCES public.lager_devices(id) ON DELETE SET NULL,
  serial_number text,
  model_name text,
  customer_id uuid,
  customer_name text,
  repair_order_id uuid,
  warranty_decision_id uuid REFERENCES public.warranty_decisions(id) ON DELETE SET NULL,
  issued_at timestamptz,
  issued_by uuid,
  condition_out text,
  returned_at timestamptz,
  returned_by uuid,
  condition_in text,
  notes text,
  status text CHECK (status IN ('ausgegeben','zurückgegeben','verloren','beschädigt')) DEFAULT 'ausgegeben',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loaner_device_assignments TO authenticated;
GRANT ALL ON public.loaner_device_assignments TO service_role;
ALTER TABLE public.loaner_device_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loaner_read" ON public.loaner_device_assignments FOR SELECT TO authenticated USING (public.can_access_warranty());
CREATE POLICY "loaner_insert" ON public.loaner_device_assignments FOR INSERT TO authenticated WITH CHECK (public.can_manage_warranty());
CREATE POLICY "loaner_update" ON public.loaner_device_assignments FOR UPDATE TO authenticated USING (public.can_manage_warranty()) WITH CHECK (public.can_manage_warranty());
CREATE POLICY "loaner_delete" ON public.loaner_device_assignments FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE INDEX IF NOT EXISTS idx_loaner_repair ON public.loaner_device_assignments(repair_order_id);
CREATE INDEX IF NOT EXISTS idx_loaner_serial ON public.loaner_device_assignments(serial_number);
CREATE TRIGGER trg_loaner_updated_at BEFORE UPDATE ON public.loaner_device_assignments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. warranty_cost_items
CREATE TABLE IF NOT EXISTS public.warranty_cost_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warranty_decision_id uuid REFERENCES public.warranty_decisions(id) ON DELETE CASCADE,
  serial_number text,
  cost_type text NOT NULL CHECK (cost_type IN ('Arbeitszeit','Ersatzteil','Versand','Technikerkosten','Kulanz','Sonstiges')),
  description text,
  quantity numeric(12,2) DEFAULT 1,
  unit_price numeric(12,2) DEFAULT 0,
  total_amount numeric(12,2) DEFAULT 0,
  billing_target text CHECK (billing_target IN ('Firma','Kunde','Hersteller')) DEFAULT 'Firma',
  cost_date date DEFAULT current_date,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warranty_cost_items TO authenticated;
GRANT ALL ON public.warranty_cost_items TO service_role;
ALTER TABLE public.warranty_cost_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wci_read" ON public.warranty_cost_items FOR SELECT TO authenticated USING (public.can_access_warranty());
CREATE POLICY "wci_insert" ON public.warranty_cost_items FOR INSERT TO authenticated WITH CHECK (public.can_manage_warranty());
CREATE POLICY "wci_update" ON public.warranty_cost_items FOR UPDATE TO authenticated USING (public.can_manage_warranty()) WITH CHECK (public.can_manage_warranty());
CREATE POLICY "wci_delete" ON public.warranty_cost_items FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE INDEX IF NOT EXISTS idx_wci_decision ON public.warranty_cost_items(warranty_decision_id);
CREATE TRIGGER trg_wci_updated_at BEFORE UPDATE ON public.warranty_cost_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Lifecycle integration: log warranty decisions
CREATE OR REPLACE FUNCTION public.trg_warranty_decision_lifecycle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.serial_number IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.decision IS NOT DISTINCT FROM NEW.decision THEN RETURN NEW; END IF;
  PERFORM public.dl_upsert(
    NEW.serial_number, NEW.device_name, NEW.customer_id, NEW.customer_name,
    'Garantie', now(), 'warranty_decisions', NEW.id::text,
    'Entscheidung: ' || COALESCE(NEW.decision,'Offen') || COALESCE(' – '||NEW.decision_reason,''),
    jsonb_build_object('source_type', NEW.source_type, 'check_result', NEW.check_result)
  );
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_wd_lifecycle ON public.warranty_decisions;
CREATE TRIGGER trg_wd_lifecycle AFTER INSERT OR UPDATE ON public.warranty_decisions
  FOR EACH ROW EXECUTE FUNCTION public.trg_warranty_decision_lifecycle();
