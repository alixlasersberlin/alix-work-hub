CREATE OR REPLACE FUNCTION public.list_staff_names(_ids uuid[] DEFAULT NULL)
RETURNS TABLE(id uuid, full_name text, is_active boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.full_name, p.is_active
  FROM public.user_profiles p
  WHERE auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.user_profiles me WHERE me.id = auth.uid() AND me.is_active)
    AND (p.is_active OR (_ids IS NOT NULL AND p.id = ANY(_ids)))
  ORDER BY p.full_name;
$$;
REVOKE ALL ON FUNCTION public.list_staff_names(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_staff_names(uuid[]) TO authenticated;