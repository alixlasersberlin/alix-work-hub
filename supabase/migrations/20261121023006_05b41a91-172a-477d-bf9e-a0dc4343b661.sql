CREATE SCHEMA IF NOT EXISTS sec_private;
REVOKE ALL ON SCHEMA sec_private FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.ac_kb_search(vector,integer,boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.alix_id_bootstrap_from_portal_users() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fc_run_escalation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mfa_status_for_user(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ticket_auto_close_stale() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ticket_sla_check_and_escalate() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.device_lock_import_raw_rows(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ac_kb_search(vector,integer,boolean), public.alix_id_bootstrap_from_portal_users(), public.fc_run_escalation(), public.mfa_status_for_user(uuid), public.ticket_auto_close_stale(), public.ticket_sla_check_and_escalate(), public.device_lock_import_raw_rows(uuid) TO service_role;

DO $do$
DECLARE
  r record; v_oid oid; v_args text; v_res text; v_n int; v_call text; v_body text; v_srv text;
BEGIN
  v_srv := '(auth.uid() IS NULL AND coalesce(auth.role(),'''') NOT IN (''anon'',''authenticated''))';
  FOR r IN SELECT * FROM (VALUES
    ('ac_web_click_heatmap(uuid,text,timestamptz,timestamptz)','public.is_internal_staff()'),
    ('ac_web_click_pages(uuid,timestamptz,timestamptz)','public.is_internal_staff()'),
    ('ac_web_session_events(text)','public.is_internal_staff()'),
    ('ac_web_sessions(uuid,timestamptz,timestamptz,integer)','public.is_internal_staff()'),
    ('ac_wfm_adherence_live()','public.is_internal_staff()'),
    ('alixdocs2_fts_search(text,integer)','public.is_internal_staff()'),
    ('check_delivery_readiness(uuid)','public.is_internal_staff()'),
    ('credit_check_order_block(uuid,numeric)','public.is_internal_staff()'),
    ('fc_order_financials(uuid)','public.is_internal_staff()'),
    ('finance_cost_center_report(accounting_region,date,date)','public.can_access_finance()'),
    ('finance_segment_report(accounting_region,date,date)','public.can_access_finance()'),
    ('gobd_org_status()','public.is_admin()'),
    ('gobd_phase15_check()','public.is_admin()'),
    ('next_backup_window()','public.is_admin()'),
    ('preview_invoice_renumbering(text)','public.is_admin()'),
    ('process_scheduled_grants()','public.is_admin()'),
    ('get_effective_roles(uuid)','($1 = auth.uid() OR public.is_admin())'),
    ('esc_user_department_ids(uuid)','($1 = auth.uid() OR public.is_admin())')
  ) t(sig, guard) LOOP
    v_oid := ('public.'||r.sig)::regprocedure;
    v_args := pg_get_function_arguments(v_oid);
    v_res := pg_get_function_result(v_oid);
    SELECT pronargs INTO v_n FROM pg_proc WHERE oid=v_oid;
    SELECT coalesce(string_agg('$'||i, ',' ORDER BY i),'') INTO v_call FROM generate_series(1,v_n) i;
    EXECUTE format('ALTER FUNCTION %s SET SCHEMA sec_private', v_oid::regprocedure);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_oid::regprocedure);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_oid::regprocedure);
    IF v_res ILIKE 'TABLE(%' OR v_res ILIKE 'SETOF %' THEN
      v_body := format('RETURN QUERY SELECT * FROM sec_private.%I(%s);', split_part(r.sig,'(',1), v_call);
    ELSIF v_res = 'void' THEN
      v_body := format('PERFORM sec_private.%I(%s);', split_part(r.sig,'(',1), v_call);
    ELSE
      v_body := format('RETURN sec_private.%I(%s);', split_part(r.sig,'(',1), v_call);
    END IF;
    EXECUTE format($f$CREATE FUNCTION public.%I(%s) RETURNS %s LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $b$
BEGIN
  IF NOT (%s OR %s) THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  %s
END $b$$f$, split_part(r.sig,'(',1), v_args, v_res, v_srv, r.guard, v_body);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', r.sig);
  END LOOP;
END $do$;