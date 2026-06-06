
CREATE TABLE public.repair_invoice_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_order_id uuid NOT NULL REFERENCES public.repair_orders(id) ON DELETE CASCADE,
  repair_number text,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  ticket_number text,
  customer_id uuid,
  customer_name text,
  customer_company text,
  customer_email text,
  customer_phone text,
  device_label text,
  device_serial text,
  labor_hours numeric,
  labor_rate numeric,
  labor_cost numeric,
  parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  parts_total numeric,
  shipping_cost numeric,
  total_amount numeric,
  currency text DEFAULT 'EUR',
  status text NOT NULL DEFAULT 'offen',
  notes text,
  invoice_id uuid,
  processed_by uuid,
  processed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rip_repair_order ON public.repair_invoice_proposals(repair_order_id);
CREATE INDEX idx_rip_status ON public.repair_invoice_proposals(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.repair_invoice_proposals TO authenticated;
GRANT ALL ON public.repair_invoice_proposals TO service_role;

ALTER TABLE public.repair_invoice_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Repair or Finance can read proposals"
  ON public.repair_invoice_proposals FOR SELECT
  TO authenticated
  USING (public.can_access_repair() OR public.can_access_finance());

CREATE POLICY "Repair can create proposals"
  ON public.repair_invoice_proposals FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_repair());

CREATE POLICY "Repair or Finance can update proposals"
  ON public.repair_invoice_proposals FOR UPDATE
  TO authenticated
  USING (public.can_manage_repair() OR public.can_access_finance())
  WITH CHECK (public.can_manage_repair() OR public.can_access_finance());

CREATE POLICY "Super Admin can delete proposals"
  ON public.repair_invoice_proposals FOR DELETE
  TO authenticated
  USING (public.has_role('Super Admin'));

CREATE TRIGGER trg_rip_updated_at
  BEFORE UPDATE ON public.repair_invoice_proposals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
