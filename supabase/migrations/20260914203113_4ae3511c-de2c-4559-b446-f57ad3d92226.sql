ALTER TABLE public.zoho_recurring_invoices
  ADD COLUMN IF NOT EXISTS legal_invoice_number text,
  ADD COLUMN IF NOT EXISTS beleg_id text,
  ADD COLUMN IF NOT EXISTS legal_number_assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS legal_number_locked boolean NOT NULL DEFAULT false;

UPDATE public.zoho_recurring_invoices
SET beleg_id = invoice_number
WHERE beleg_id IS NULL AND invoice_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_zoho_recurring_invoices_legal_number
  ON public.zoho_recurring_invoices (legal_invoice_number);