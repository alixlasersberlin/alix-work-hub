
CREATE OR REPLACE FUNCTION public.gobd_restore_compare_one(_run_id uuid, _counts jsonb, _table text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.gobd_restore_compare(_run_id, _counts, ARRAY[_table]);
END; $$;

REVOKE EXECUTE ON FUNCTION public.gobd_restore_compare_one(uuid, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gobd_restore_compare_one(uuid, jsonb, text) TO service_role;
