ALTER TABLE public.zoho_recurring_invoices
  ADD COLUMN IF NOT EXISTS accounting_region public.accounting_region NOT NULL DEFAULT 'EU';

CREATE OR REPLACE FUNCTION public.zoho_recurring_invoice_set_region()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF upper(coalesce(NEW.currency, '')) = 'CHF'
     OR coalesce(NEW.raw_data::text, '') ILIKE '%Alix Lasers ® Schweiz%'
     OR coalesce(NEW.raw_data::text, '') ILIKE '%Alix Lasers (R) Schweiz%'
     OR coalesce(NEW.billing_address::text, '') ILIKE '%schweiz%'
     OR coalesce(NEW.billing_address::text, '') ILIKE '%switzerland%'
  THEN
    NEW.accounting_region := 'CH';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zoho_recurring_invoice_set_region ON public.zoho_recurring_invoices;
CREATE TRIGGER trg_zoho_recurring_invoice_set_region
BEFORE INSERT OR UPDATE ON public.zoho_recurring_invoices
FOR EACH ROW EXECUTE FUNCTION public.zoho_recurring_invoice_set_region();

UPDATE public.zoho_recurring_invoices
SET accounting_region = 'CH'
WHERE accounting_region <> 'CH'
  AND (
    upper(coalesce(currency, '')) = 'CHF'
    OR coalesce(raw_data::text, '') ILIKE '%Alix Lasers ® Schweiz%'
    OR coalesce(billing_address::text, '') ILIKE '%schweiz%'
    OR coalesce(billing_address::text, '') ILIKE '%switzerland%'
  );

CREATE INDEX IF NOT EXISTS idx_zoho_recurring_invoices_region
  ON public.zoho_recurring_invoices (accounting_region);