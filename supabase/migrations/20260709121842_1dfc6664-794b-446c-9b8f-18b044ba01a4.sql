ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS invoiced_flag boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.orders.invoiced_flag IS
  'Zweiter Vermerk: Zoho meldet invoiced_status = invoiced, der operative Auftragsstatus bleibt aber unverändert (z. B. geliefert).';

-- Bestehende Aufträge, die aktuell in Zoho invoiced sind (raw_data.invoiced_status),
-- bekommen das Flag gesetzt, damit die UI konsistent bleibt.
UPDATE public.orders
SET invoiced_flag = true
WHERE (raw_data->>'invoiced_status') = 'invoiced'
  AND invoiced_flag = false;