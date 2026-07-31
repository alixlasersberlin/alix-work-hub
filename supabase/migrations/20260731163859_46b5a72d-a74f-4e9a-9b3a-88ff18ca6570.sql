ALTER TABLE public.zoho_recurring_invoices
  ADD COLUMN IF NOT EXISTS is_mietkauf boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mietkauf_booked_at timestamptz,
  ADD COLUMN IF NOT EXISTS mietkauf_booked_by uuid;

CREATE INDEX IF NOT EXISTS idx_zoho_recurring_invoices_mietkauf
  ON public.zoho_recurring_invoices (is_mietkauf);