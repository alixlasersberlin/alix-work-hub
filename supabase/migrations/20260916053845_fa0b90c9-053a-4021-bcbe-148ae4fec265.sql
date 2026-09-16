
REVOKE EXECUTE ON FUNCTION public.fibu_light_bank_suggestions(uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fibu_light_bank_list(text, text, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fibu_light_bank_group_suggestion(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fibu_light_bank_confirm(uuid, jsonb, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fibu_light_bank_set_case(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fibu_light_bank_dashboard() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.op_light_norm_ref(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fibu_light_bank_suggestions(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fibu_light_bank_list(text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fibu_light_bank_group_suggestion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fibu_light_bank_confirm(uuid, jsonb, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fibu_light_bank_set_case(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fibu_light_bank_dashboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.op_light_norm_ref(text) TO authenticated;
