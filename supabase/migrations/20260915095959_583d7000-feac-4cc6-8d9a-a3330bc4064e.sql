REVOKE EXECUTE ON FUNCTION public.gobd_set_responsibility(text,text,text,text,text,text,text,boolean,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.gobd_record_approval(text,text,text,text,text,text,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.gobd_org_status() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.gobd_generate_final_report() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.gobd_worm_guard() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.gobd_set_responsibility(text,text,text,text,text,text,text,boolean,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gobd_record_approval(text,text,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gobd_org_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.gobd_generate_final_report() TO authenticated;