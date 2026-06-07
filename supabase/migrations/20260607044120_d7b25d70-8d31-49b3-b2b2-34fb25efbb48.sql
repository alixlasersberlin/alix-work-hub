CREATE OR REPLACE FUNCTION public.get_table_columns(_table text)
RETURNS text[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(column_name::text ORDER BY ordinal_position), '{}')
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = _table;
$$;
GRANT EXECUTE ON FUNCTION public.get_table_columns(text) TO authenticated, service_role;