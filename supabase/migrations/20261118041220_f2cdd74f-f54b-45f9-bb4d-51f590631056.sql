ALTER FUNCTION public.gobd_retention_overview() RENAME TO gobd_retention_overview_impl;
ALTER FUNCTION public.gobd_retention_dry_run(boolean) RENAME TO gobd_retention_dry_run_impl;
REVOKE EXECUTE ON FUNCTION public.gobd_retention_overview_impl() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gobd_retention_dry_run_impl(boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gobd_retention_overview_impl() TO service_role;
GRANT EXECUTE ON FUNCTION public.gobd_retention_dry_run_impl(boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.gobd_retention_overview()
RETURNS TABLE(data_class text, label text, source_table text, retention_years integer, retention_start_rule text, storage_location text, deletable boolean, responsible_role text, legal_hold_capable boolean, legal_basis text, total_records bigint, oldest date, earliest_due date, active_holds bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Buchhaltung Admin')
          OR public.has_role('Buchhaltung EU') OR public.has_role('Buchhaltung CH')) THEN
    RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT * FROM public.gobd_retention_overview_impl();
END $$;

CREATE OR REPLACE FUNCTION public.gobd_retention_dry_run(_log boolean DEFAULT true)
RETURNS TABLE(data_class text, label text, source_table text, total_records bigint, period_from date, period_to date, due_for_deletion bigint, blocked_retention bigint, blocked_legal_hold bigint, blocked_not_deletable bigint, would_delete bigint, exclusion_reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Buchhaltung Admin')
          OR public.has_role('Buchhaltung EU') OR public.has_role('Buchhaltung CH')) THEN
    RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT * FROM public.gobd_retention_dry_run_impl(_log);
END $$;

REVOKE EXECUTE ON FUNCTION public.gobd_retention_overview() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.gobd_retention_dry_run(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gobd_retention_overview() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gobd_retention_dry_run(boolean) TO authenticated, service_role;