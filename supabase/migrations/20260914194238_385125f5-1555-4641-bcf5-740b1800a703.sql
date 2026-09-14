DROP FUNCTION IF EXISTS public.run_invoice_renumbering(text);

CREATE OR REPLACE FUNCTION public.run_invoice_renumbering(p_period text DEFAULT NULL, p_limit integer DEFAULT 300)
RETURNS TABLE(migrated integer, remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_count integer := 0;
  v_num text;
  v_remaining integer;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'Super Admin') OR public.has_role(auth.uid(), 'Admin')) THEN
    RAISE EXCEPTION 'Keine Berechtigung für die Migration';
  END IF;

  FOR r IN
    SELECT i.id,
           i.invoice_number,
           i.invoice_date,
           to_char(coalesce(i.invoice_date, i.created_at::date), 'YYYY-MM') AS per
    FROM public.zoho_invoices i
    WHERE i.legal_invoice_number IS NULL
      AND (p_period IS NULL OR to_char(coalesce(i.invoice_date, i.created_at::date), 'YYYY-MM') = p_period)
    ORDER BY to_char(coalesce(i.invoice_date, i.created_at::date), 'YYYY-MM'),
             i.invoice_date NULLS LAST, i.created_at, i.invoice_number
    LIMIT greatest(coalesce(p_limit, 300), 1)
  LOOP
    v_num := public.next_invoice_number(coalesce(r.invoice_date, current_date));

    UPDATE public.zoho_invoices
    SET beleg_id = coalesce(beleg_id, invoice_number),
        legal_invoice_number = v_num,
        legal_number_assigned_at = now(),
        legal_number_locked = true
    WHERE id = r.id;

    INSERT INTO public.invoice_number_audit (invoice_id, beleg_id, old_number, new_number, action, reason, actor)
    VALUES (r.id, r.invoice_number, r.invoice_number, v_num, 'migrate', 'Migration Nummernkreis YYYY-MM-NNNN', auth.uid());

    INSERT INTO public.invoice_number_migrations (invoice_id, old_number, new_number, invoice_date, status)
    VALUES (r.id, r.invoice_number, v_num, r.invoice_date, 'erfolgreich')
    ON CONFLICT (invoice_id) DO NOTHING;

    v_count := v_count + 1;
  END LOOP;

  SELECT count(*) INTO v_remaining
  FROM public.zoho_invoices i
  WHERE i.legal_invoice_number IS NULL
    AND (p_period IS NULL OR to_char(coalesce(i.invoice_date, i.created_at::date), 'YYYY-MM') = p_period);

  RETURN QUERY SELECT v_count, v_remaining;
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_invoice_renumbering(text, integer) TO authenticated;