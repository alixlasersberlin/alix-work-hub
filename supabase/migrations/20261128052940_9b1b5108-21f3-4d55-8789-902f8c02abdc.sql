CREATE OR REPLACE FUNCTION public.has_tenant_access(_tenant_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.user_has_tenant(_tenant_id); $$;
CREATE OR REPLACE FUNCTION public.is_internal_user() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT cardinality(public.user_tenant_codes())>0 AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=(SELECT auth.uid())); $$;
DO $migration$
DECLARE tab text; pol record;
BEGIN
 FOREACH tab IN ARRAY ARRAY['ac_contacts','ac_conversations','ac_messages','alixdocs_documents','finance_transactions'] LOOP
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=tab AND policyname IN ('tenant_data_scope_delete','tenant_data_scope_select','tenant_data_scope_write','tenant_scope_finance_transactions') LOOP
   EXECUTE format('DROP POLICY %I ON public.%I',pol.policyname,tab);
  END LOOP;
  EXECUTE format('CREATE POLICY security_v3_account_tenant_scope ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (cardinality((SELECT public.user_tenant_codes()))>0 AND ((SELECT NOT public.tenant_scope_restricted()) OR tenant_id IN (SELECT a.tenant_id FROM public.user_tenant_access a JOIN public.tenants t ON t.id=a.tenant_id WHERE a.user_id=(SELECT auth.uid()) AND t.is_active IS TRUE))) WITH CHECK (cardinality((SELECT public.user_tenant_codes()))>0 AND ((SELECT NOT public.tenant_scope_restricted()) OR tenant_id IN (SELECT a.tenant_id FROM public.user_tenant_access a JOIN public.tenants t ON t.id=a.tenant_id WHERE a.user_id=(SELECT auth.uid()) AND t.is_active IS TRUE)))',tab);
 END LOOP;
END $migration$;
DROP POLICY region_scope_select ON public.finance_transactions;
CREATE POLICY region_scope_select ON public.finance_transactions FOR SELECT TO authenticated USING ((SELECT public.is_internal_user()) AND public.has_accounting_region((SELECT auth.uid()),accounting_region));
-- These assertions validate the actual policy category, not an unrelated marker.
DO $$ DECLARE n integer; BEGIN
 SELECT count(*) INTO n FROM pg_policies WHERE schemaname='public' AND tablename=ANY(ARRAY['ac_contacts','ac_conversations','ac_messages','alixdocs_documents','finance_transactions']) AND policyname='security_v3_account_tenant_scope' AND permissive='RESTRICTIVE' AND cmd='ALL';
 IF n<>5 THEN RAISE EXCEPTION 'Expected five mandatory account/tenant restrictions'; END IF;
 IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=ANY(ARRAY['ac_contacts','ac_conversations','ac_messages','alixdocs_documents','finance_transactions']) AND policyname LIKE 'tenant_data_scope_%') THEN RAISE EXCEPTION 'Standalone tenant privilege bypass remains'; END IF;
 IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='finance_transactions' AND policyname='region_scope_select' AND cmd<>'SELECT') THEN RAISE EXCEPTION 'Region membership grants writes'; END IF;
END $$;