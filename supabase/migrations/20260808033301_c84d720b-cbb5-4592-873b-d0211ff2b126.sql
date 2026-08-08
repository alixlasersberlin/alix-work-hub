-- Vorgangsnummern an internen Sofortaufträgen nachtragen
UPDATE public.orders o
SET case_number = f.cn,
    order_number = 'AB-' || f.cn
FROM (VALUES
  ('AB-2026-00052','2026-04295'),
  ('AB-2026-00056','2026-04299'),
  ('AB-2026-00057','2026-04301')
) AS f(old_nr, cn)
WHERE o.order_number = f.old_nr AND o.source_system = 'internal';

-- Zugehörige Rechnungen auf den gemeinsamen Nummernkreis umstellen
UPDATE public.zoho_invoices i
SET invoice_number = 'RE-' || f.cn,
    reference_number = 'AB-' || f.cn
FROM (VALUES
  ('RE-2026-00052','2026-04295'),
  ('RE-2026-00056','2026-04299'),
  ('RE-2026-00057','2026-04301')
) AS f(old_nr, cn)
WHERE i.invoice_number = f.old_nr;