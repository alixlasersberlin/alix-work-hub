ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_mietkauf boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mietkauf_booked_at timestamptz,
  ADD COLUMN IF NOT EXISTS mietkauf_booked_by uuid;

ALTER TABLE public.zoho_invoices
  ADD COLUMN IF NOT EXISTS is_mietkauf boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mietkauf_booked_at timestamptz,
  ADD COLUMN IF NOT EXISTS mietkauf_booked_by uuid;

CREATE INDEX IF NOT EXISTS idx_orders_is_mietkauf ON public.orders(is_mietkauf) WHERE is_mietkauf;
CREATE INDEX IF NOT EXISTS idx_zoho_invoices_is_mietkauf ON public.zoho_invoices(is_mietkauf) WHERE is_mietkauf;