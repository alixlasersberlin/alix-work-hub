
ALTER TABLE public.finance_deposits ADD COLUMN IF NOT EXISTS country text;
CREATE INDEX IF NOT EXISTS idx_finance_deposits_country ON public.finance_deposits(country);

-- Backfill AlixWork deposits from linked orders
UPDATE public.finance_deposits d
SET country = CASE WHEN o.source_system = 'zoho_eu_2' THEN 'AT' ELSE 'DE' END
FROM public.orders o
WHERE d.order_id = o.id AND d.country IS NULL;

-- Backfill Zoho deposits from zoho_invoices (if that table has source_system)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'zoho_invoices' AND column_name = 'source_system'
  ) THEN
    EXECUTE $sql$
      UPDATE public.finance_deposits d
      SET country = CASE WHEN zi.source_system = 'zoho_eu_2' THEN 'AT' ELSE 'DE' END
      FROM public.zoho_invoices zi
      WHERE d.source = 'zoho'
        AND d.source_ref = zi.id::text
        AND d.country IS NULL
    $sql$;
  END IF;
END $$;

-- Fallback: rows still without country → 'DE'
UPDATE public.finance_deposits SET country = 'DE' WHERE country IS NULL;
