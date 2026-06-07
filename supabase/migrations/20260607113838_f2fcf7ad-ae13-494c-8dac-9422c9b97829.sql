
-- Phase 6: Dispatch / Tourenplanung – additive only
ALTER TABLE public.route_plans ALTER COLUMN order_id DROP NOT NULL;

ALTER TABLE public.route_plans
  ADD COLUMN IF NOT EXISTS tour_type text,
  ADD COLUMN IF NOT EXISTS ticket_id uuid,
  ADD COLUMN IF NOT EXISTS repair_order_id uuid,
  ADD COLUMN IF NOT EXISTS customer_id uuid,
  ADD COLUMN IF NOT EXISTS device_serial_number text,
  ADD COLUMN IF NOT EXISTS device_model text,
  ADD COLUMN IF NOT EXISTS finance_id uuid,
  ADD COLUMN IF NOT EXISTS technician_user_id uuid,
  ADD COLUMN IF NOT EXISTS vehicle_id uuid,
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS requested_date date,
  ADD COLUMN IF NOT EXISTS check_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS check_out_at timestamptz,
  ADD COLUMN IF NOT EXISTS work_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS work_ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS signature_path text,
  ADD COLUMN IF NOT EXISTS report_pdf_path text,
  ADD COLUMN IF NOT EXISTS result_outcome text,
  ADD COLUMN IF NOT EXISTS next_step text,
  ADD COLUMN IF NOT EXISTS fault_description text,
  ADD COLUMN IF NOT EXISTS work_performed text;

CREATE INDEX IF NOT EXISTS idx_route_plans_tech_date ON public.route_plans(technician_user_id, planned_date);
CREATE INDEX IF NOT EXISTS idx_route_plans_ticket ON public.route_plans(ticket_id);
CREATE INDEX IF NOT EXISTS idx_route_plans_repair ON public.route_plans(repair_order_id);
CREATE INDEX IF NOT EXISTS idx_route_plans_customer ON public.route_plans(customer_id);

-- Fahrzeugstamm
CREATE TABLE IF NOT EXISTS public.dispatch_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  license_plate text,
  driver_user_id uuid,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dispatch_vehicles TO authenticated;
GRANT ALL ON public.dispatch_vehicles TO service_role;
ALTER TABLE public.dispatch_vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dv read" ON public.dispatch_vehicles FOR SELECT TO authenticated USING (public.can_access_planning());
CREATE POLICY "dv ins" ON public.dispatch_vehicles FOR INSERT TO authenticated WITH CHECK (public.can_manage_planning());
CREATE POLICY "dv upd" ON public.dispatch_vehicles FOR UPDATE TO authenticated USING (public.can_manage_planning());
CREATE POLICY "dv del" ON public.dispatch_vehicles FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_dv_updated BEFORE UPDATE ON public.dispatch_vehicles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Anhänge zu Tour
CREATE TABLE IF NOT EXISTS public.dispatch_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_plan_id uuid NOT NULL REFERENCES public.route_plans(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text,
  mime_type text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dispatch_attachments TO authenticated;
GRANT ALL ON public.dispatch_attachments TO service_role;
ALTER TABLE public.dispatch_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "da read" ON public.dispatch_attachments FOR SELECT TO authenticated USING (public.can_access_planning());
CREATE POLICY "da ins" ON public.dispatch_attachments FOR INSERT TO authenticated WITH CHECK (public.can_access_planning());
CREATE POLICY "da upd" ON public.dispatch_attachments FOR UPDATE TO authenticated USING (public.can_manage_planning());
CREATE POLICY "da del" ON public.dispatch_attachments FOR DELETE TO authenticated USING (public.has_role('Super Admin') OR public.can_manage_planning());

-- Verwendete Teile (für Nicht-Reparatur-Touren)
CREATE TABLE IF NOT EXISTS public.dispatch_used_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_plan_id uuid NOT NULL REFERENCES public.route_plans(id) ON DELETE CASCADE,
  part_name text NOT NULL,
  part_sku text,
  quantity numeric NOT NULL DEFAULT 1,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dispatch_used_parts TO authenticated;
GRANT ALL ON public.dispatch_used_parts TO service_role;
ALTER TABLE public.dispatch_used_parts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dup read" ON public.dispatch_used_parts FOR SELECT TO authenticated USING (public.can_access_planning());
CREATE POLICY "dup ins" ON public.dispatch_used_parts FOR INSERT TO authenticated WITH CHECK (public.can_access_planning());
CREATE POLICY "dup upd" ON public.dispatch_used_parts FOR UPDATE TO authenticated USING (public.can_access_planning());
CREATE POLICY "dup del" ON public.dispatch_used_parts FOR DELETE TO authenticated USING (public.has_role('Super Admin') OR public.can_manage_planning());
