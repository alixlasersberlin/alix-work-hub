DROP POLICY tenant_data_scope_write ON public.ac_analytics_events;
CREATE POLICY tenant_data_scope_insert ON public.ac_analytics_events AS RESTRICTIVE FOR INSERT TO public WITH CHECK (((SELECT NOT public.tenant_scope_restricted()) OR public.tenant_scope_id_ok(tenant_id)));
CREATE POLICY tenant_data_scope_update ON public.ac_analytics_events AS RESTRICTIVE FOR UPDATE TO public USING (((SELECT NOT public.tenant_scope_restricted()) OR public.tenant_scope_id_ok(tenant_id))) WITH CHECK (((SELECT NOT public.tenant_scope_restricted()) OR public.tenant_scope_id_ok(tenant_id)));
ALTER POLICY tenant_data_scope_select ON public.ac_analytics_events USING (
 (SELECT cardinality(public.user_tenant_codes()) > 0)
 AND (tenant_id IN (SELECT a.tenant_id FROM public.user_tenant_access a JOIN public.tenants t ON t.id=a.tenant_id WHERE a.user_id=(SELECT auth.uid()) AND t.is_active IS TRUE)
 OR (tenant_id IS NULL AND website_id IN (SELECT w.id FROM public.ac_websites w WHERE w.tenant_id IN (SELECT a.tenant_id FROM public.user_tenant_access a JOIN public.tenants t ON t.id=a.tenant_id WHERE a.user_id=(SELECT auth.uid()) AND t.is_active IS TRUE))))
);
-- Read-only assertions run as the actual restricted role, not the migration owner.
DO $$ DECLARE claims text:=current_setting('request.jwt.claims',true); uid text:=current_setting('request.jwt.claim.sub',true); metrics jsonb; BEGIN
 PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}',true);
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000000',true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 IF EXISTS(SELECT 1 FROM public.ac_analytics_events) THEN RAISE EXCEPTION 'Unassigned user can read events'; END IF;
 SELECT public.ac_dashboard_kpis(NULL::uuid) INTO metrics;
 IF (metrics->>'events')::integer<>0 OR (metrics->>'messages')::integer<>0 OR (metrics->>'contacts')::integer<>0 THEN RAISE EXCEPTION 'Unassigned dashboard leaks counts'; END IF;
 IF EXISTS(SELECT 1 FROM public.ac_journey_funnel(30)) THEN RAISE EXCEPTION 'Unassigned funnel leaks events'; END IF;
 IF EXISTS(SELECT 1 FROM public.ac_web_live_map('00000000-0000-0000-0000-000000000000')) THEN RAISE EXCEPTION 'Missing website leaks visitor locations'; END IF;
 EXECUTE 'RESET ROLE';
 PERFORM set_config('request.jwt.claims',coalesce(claims,''),true); PERFORM set_config('request.jwt.claim.sub',coalesce(uid,''),true);
END $$;