ALTER TABLE public.bank_return_debits
  ADD COLUMN IF NOT EXISTS fee_invoice_id uuid,
  ADD COLUMN IF NOT EXISTS fee_invoice_number text,
  ADD COLUMN IF NOT EXISTS fee_invoice_status text,
  ADD COLUMN IF NOT EXISTS fee_invoice_total numeric,
  ADD COLUMN IF NOT EXISTS fee_invoice_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_brd_fee_invoice_id ON public.bank_return_debits(fee_invoice_id);

UPDATE public.bank_return_debits rd
SET fee_invoice_id = i.id,
    fee_invoice_number = i.invoice_number,
    fee_invoice_status = COALESCE(i.payment_status, i.status),
    fee_invoice_total = i.total
FROM public.zoho_invoices i
WHERE i.source_system = 'internal'
  AND i.zoho_invoice_id = 'rd-fee-' || rd.id::text
  AND rd.fee_invoice_id IS DISTINCT FROM i.id;