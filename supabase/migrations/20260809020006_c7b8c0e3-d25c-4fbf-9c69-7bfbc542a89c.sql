CREATE OR REPLACE FUNCTION public.delete_recurring_profile_with_reason(p_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role('Super Admin') THEN
    RAISE EXCEPTION 'Nur Super Admin darf löschen';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'Begründung erforderlich (mind. 5 Zeichen)';
  END IF;

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, details)
  VALUES (auth.uid(), 'delete', 'zoho_recurring_profiles', p_id::text,
          jsonb_build_object('reason', p_reason));

  DELETE FROM public.zoho_recurring_profiles WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_recurring_profile_with_reason(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.delete_recurring_profile_with_reason(uuid, text) TO authenticated;