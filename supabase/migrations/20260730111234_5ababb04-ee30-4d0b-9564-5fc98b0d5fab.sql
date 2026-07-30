ALTER TABLE public.zoho_invoices
  ADD COLUMN IF NOT EXISTS accounting_region public.accounting_region NOT NULL DEFAULT 'EU';

CREATE OR REPLACE FUNCTION public.zoho_invoice_set_region()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.raw_data::text ILIKE '%Alix Lasers ® Schweiz%')
     OR (NEW.raw_data::text ILIKE '%Alix Lasers (R) Schweiz%')
     OR (upper(coalesce(NEW.currency,'')) = 'CHF') THEN
    NEW.accounting_region := 'CH';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zoho_invoice_set_region ON public.zoho_invoices;
CREATE TRIGGER trg_zoho_invoice_set_region
BEFORE INSERT OR UPDATE ON public.zoho_invoices
FOR EACH ROW EXECUTE FUNCTION public.zoho_invoice_set_region();

UPDATE public.zoho_invoices
SET accounting_region = 'CH'
WHERE accounting_region <> 'CH'
  AND (raw_data::text ILIKE '%Alix Lasers ® Schweiz%' OR upper(coalesce(currency,'')) = 'CHF');

CREATE INDEX IF NOT EXISTS idx_zoho_invoices_region_date
  ON public.zoho_invoices (accounting_region, invoice_date DESC);