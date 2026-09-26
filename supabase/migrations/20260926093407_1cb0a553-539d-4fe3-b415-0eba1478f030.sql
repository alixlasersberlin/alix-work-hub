WITH c AS (
  SELECT DISTINCT p.customer_id, coalesce(nullif(cu.company_name,''), cu.contact_name) AS name
  FROM public.rp_payment_plans p JOIN public.customers cu ON cu.id = p.customer_id
  WHERE p.payment_method='sepa' AND p.mandate_id IS NULL
), ins AS (
  INSERT INTO public.rp_mandates (customer_id, mandate_reference, account_holder, status, sequence_type)
  SELECT customer_id, 'OFFEN-' || upper(substr(replace(customer_id::text,'-',''),1,12)), name, 'fehlerhaft', 'FRST'
  FROM c
  ON CONFLICT (mandate_reference) DO NOTHING
  RETURNING id, customer_id
)
UPDATE public.rp_payment_plans p SET mandate_id = ins.id
FROM ins WHERE p.customer_id = ins.customer_id AND p.payment_method='sepa' AND p.mandate_id IS NULL;