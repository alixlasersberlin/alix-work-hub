CREATE OR REPLACE FUNCTION public.delete_recurring_profile_with_reason(p_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.zoho_recurring_profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Nicht authentifiziert';
  END IF;

  IF NOT (public.has_role(auth.uid(), 'Super Admin') OR public.has_role(auth.uid(), 'Admin')) THEN
    RAISE EXCEPTION 'Keine Berechtigung zum Löschen';
  END IF;

  IF p_reason IS NULL OR length(btrim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'Löschgrund ist erforderlich (mindestens 5 Zeichen)';
  END IF;

  SELECT * INTO v_row FROM public.zoho_recurring_profiles WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Buchung nicht gefunden';
  END IF;

  DELETE FROM public.zoho_recurring_profiles WHERE id = p_id;

  INSERT INTO public.audit_logs (user_id, action, module, record_id, details)
  VALUES (
    auth.uid(),
    'delete',
    'finance_recurring_profiles',
    p_id::text,
    jsonb_build_object(
      'reason', btrim(p_reason),
      'recurrence_name', v_row.recurrence_name,
      'reference_number', v_row.reference_number,
      'customer_name', v_row.customer_name,
      'customer_id', v_row.customer_id,
      'zoho_recurring_invoice_id', v_row.zoho_recurring_invoice_id,
      'status', v_row.status,
      'total', v_row.total,
      'currency', v_row.currency
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_recurring_profile_with_reason(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_recurring_profile_with_reason(uuid, text) TO authenticated;