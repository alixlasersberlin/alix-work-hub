ALTER FUNCTION public.fibu_light_set_due_date(uuid,date,date) SECURITY DEFINER;
ALTER FUNCTION public.fibu_light_set_due_date(uuid,date,date) SET search_path = public;
REVOKE ALL ON FUNCTION public.fibu_light_set_due_date(uuid,date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fibu_light_set_due_date(uuid,date,date) TO authenticated;