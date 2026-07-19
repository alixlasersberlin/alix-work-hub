CREATE OR REPLACE FUNCTION public.alixdocs_soft_delete(_doc_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role('Super Admin') OR public.has_role('Admin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.alixdocs_documents
     SET deleted_at = now()
   WHERE id = _doc_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.alixdocs_soft_delete(uuid) TO authenticated;