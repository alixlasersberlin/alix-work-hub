DELETE FROM public.finance_records 
WHERE order_id = (SELECT id FROM public.orders WHERE order_number = 'SO-4186')
  AND finance_note LIKE 'Ratenplan Rate %';