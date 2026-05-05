CREATE TABLE public.invoice_workflow_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  invoice_key text NOT NULL,
  invoice_number text,
  workflow_status text NOT NULL DEFAULT 'offen',
  note text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, invoice_key)
);

ALTER TABLE public.invoice_workflow_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance can read invoice workflow states"
ON public.invoice_workflow_states FOR SELECT
TO authenticated
USING (can_access_finance());

CREATE POLICY "finance can insert invoice workflow states"
ON public.invoice_workflow_states FOR INSERT
TO authenticated
WITH CHECK (can_access_finance());

CREATE POLICY "finance can update invoice workflow states"
ON public.invoice_workflow_states FOR UPDATE
TO authenticated
USING (can_access_finance())
WITH CHECK (can_access_finance());

CREATE POLICY "admins can delete invoice workflow states"
ON public.invoice_workflow_states FOR DELETE
TO authenticated
USING (is_admin());

CREATE TRIGGER trg_invoice_workflow_states_updated_at
BEFORE UPDATE ON public.invoice_workflow_states
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_invoice_workflow_states_updated_by
BEFORE INSERT OR UPDATE ON public.invoice_workflow_states
FOR EACH ROW EXECUTE FUNCTION public.set_updated_by();