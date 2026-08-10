DO $$
DECLARE
  keep uuid := '9dd885ce-7dd2-467f-b11f-d03f686e1257';
  dup  uuid := '2db4940f-6c09-4584-ab08-b4e5c8212f9b';
  r record;
BEGIN
  FOR r IN
    SELECT c.conrelid::regclass::text AS tbl, a.attname AS col
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.confrelid = 'public.customers'::regclass AND c.contype = 'f'
  LOOP
    EXECUTE format('UPDATE %s SET %I = $1 WHERE %I = $2', r.tbl, r.col, r.col) USING keep, dup;
  END LOOP;

  UPDATE public.zoho_invoices SET customer_id = keep::text WHERE customer_id = dup::text;

  DELETE FROM public.customers WHERE id = dup;
END $$;