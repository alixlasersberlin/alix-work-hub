UPDATE public.zoho_invoices
SET customer_id = '9dd885ce-7dd2-467f-b11f-d03f686e1257'
WHERE customer_name ILIKE '%Belmon Look Cosmetics%'
  AND (customer_id IS DISTINCT FROM '9dd885ce-7dd2-467f-b11f-d03f686e1257');

UPDATE public.zoho_unpaid_invoices
SET customer_name = 'Belmon Look Cosmetics GmbH'
WHERE customer_name ILIKE '%Belmon Look Cosmetics%';

UPDATE public.collect_cases
SET customer_id = '9dd885ce-7dd2-467f-b11f-d03f686e1257'
WHERE customer_name ILIKE '%Belmon Look Cosmetics%'
  AND customer_id IS DISTINCT FROM '9dd885ce-7dd2-467f-b11f-d03f686e1257';