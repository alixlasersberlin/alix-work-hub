UPDATE public.zoho_invoices i
SET customer_id = src.cid
FROM (
  SELECT lower(trim(customer_name)) AS n, min(nullif(customer_id,'')) AS cid
  FROM public.zoho_invoices
  WHERE nullif(customer_id,'') IS NOT NULL
  GROUP BY 1
  HAVING count(DISTINCT nullif(customer_id,'')) = 1
) src
WHERE nullif(i.customer_id,'') IS NULL
  AND lower(trim(i.customer_name)) = src.n;

UPDATE public.zoho_invoices i
SET customer_id = src.cid
FROM (
  SELECT lower(trim(customer_name)) AS n, min(nullif(raw->>'customer_id','')) AS cid
  FROM public.zoho_unpaid_invoices
  WHERE nullif(raw->>'customer_id','') IS NOT NULL
  GROUP BY 1
  HAVING count(DISTINCT nullif(raw->>'customer_id','')) = 1
) src
WHERE nullif(i.customer_id,'') IS NULL
  AND lower(trim(i.customer_name)) = src.n;