ALTER FUNCTION public.fc_month_close(date,date) SECURITY INVOKER;
ALTER FUNCTION public.finance_db_summary(public.accounting_region,date,date) SECURITY INVOKER;
ALTER FUNCTION public.hoo_ops_kpis() SECURITY INVOKER;
ALTER FUNCTION public.lager_overview_counts() SECURITY INVOKER;
ALTER FUNCTION public.main_dashboard_kpis(boolean) SECURITY INVOKER;
ALTER FUNCTION public.main_dashboard_tenant_kpis(text,uuid,boolean) SECURITY INVOKER;
ALTER FUNCTION public.order_status_counts(uuid) SECURITY INVOKER;
ALTER FUNCTION public.sidebar_lager_counts() SECURITY INVOKER;
ALTER FUNCTION public.sidebar_production_counts(boolean) SECURITY INVOKER;
ALTER FUNCTION public.tickets_dashboard_counts(uuid) SECURITY INVOKER;
ALTER FUNCTION public.tickets_dashboard_counts(uuid,text) SECURITY INVOKER;
ALTER FUNCTION public.get_table_columns(text) SECURITY INVOKER;
ALTER FUNCTION public.fc_order_invoice_gap(uuid) SECURITY INVOKER;
ALTER FUNCTION public.fc_order_financials(uuid) SECURITY INVOKER;
ALTER FUNCTION sec_private.fc_order_financials(uuid) SECURITY INVOKER;
GRANT EXECUTE ON FUNCTION sec_private.fc_order_financials(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION sec_private.fc_order_financials(uuid) FROM PUBLIC,anon;

DO $patch$
DECLARE d text; old text;
BEGIN
 SELECT pg_get_functiondef('sec_private.fc_order_financials(uuid)'::regprocedure) INTO d;old:=d;
 d:=replace(d, 'WHERE lower(COALESCE(i.status,'''')', 'WHERE i.source_system IS NOT DISTINCT FROM o.source_system AND i.tenant_id IS NOT DISTINCT FROM o.tenant_id AND lower(COALESCE(i.status,'''')');
 IF d=old THEN RAISE EXCEPTION 'Financial source patch mismatch'; END IF;
 EXECUTE d;
END $patch$;

DO $assert$
DECLARE s text;
BEGIN
 FOREACH s IN ARRAY ARRAY['public.fc_month_close(date,date)','public.finance_db_summary(public.accounting_region,date,date)','public.hoo_ops_kpis()','public.lager_overview_counts()','public.main_dashboard_kpis(boolean)','public.main_dashboard_tenant_kpis(text,uuid,boolean)','public.order_status_counts(uuid)','public.sidebar_lager_counts()','public.sidebar_production_counts(boolean)','public.tickets_dashboard_counts(uuid)','public.tickets_dashboard_counts(uuid,text)','public.get_table_columns(text)','public.fc_order_invoice_gap(uuid)','public.fc_order_financials(uuid)','sec_private.fc_order_financials(uuid)'] LOOP
 IF (SELECT prosecdef FROM pg_proc WHERE oid=s::regprocedure) THEN RAISE EXCEPTION 'Aggregate still bypasses caller RLS: %',s; END IF;
 IF NOT has_function_privilege('authenticated',s,'EXECUTE') THEN RAISE EXCEPTION 'Authenticated compatibility lost: %',s; END IF;
 END LOOP;
END $assert$;