DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS identity FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef AND p.prorettype='trigger'::regtype LOOP
  EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.identity);
 END LOOP;
 FOR f IN SELECT p.oid::regprocedure AS identity FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','sec_private') AND p.prosecdef AND p.proname IN ('ac_dashboard_kpis','ac_journey_cohorts','ac_portal_deflection','ac_web_click_heatmap','ac_web_click_pages','ac_web_session_events','ac_web_sessions','ac_web_live','ac_web_top_pages','ac_web_live_map','ac_web_breakdown','ac_web_daily_series','ac_web_goals_summary','ac_web_funnel_stats','ac_web_experiment_stats','ac_web_segment_stats','ac_journey_funnel','ac_journey_attribution','ac_portal_deflection_breakdown','ac_journey_attribution_ext') LOOP
  EXECUTE format('ALTER FUNCTION %s SECURITY INVOKER', f.identity);
  EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon',f.identity);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role',f.identity);
 END LOOP;
END $$;
GRANT USAGE ON SCHEMA sec_private TO authenticated;

CREATE OR REPLACE FUNCTION public.ac_studio_draft_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.handoff_rules->>'studio_version'='phase36' AND (NEW.handoff_rules->>'studio_version' IS DISTINCT FROM 'phase36' OR NEW.handoff_rules->>'tenant_id' IS DISTINCT FROM OLD.handoff_rules->>'tenant_id' OR NEW.handoff_rules->>'created_by' IS DISTINCT FROM OLD.handoff_rules->>'created_by') THEN
  RAISE EXCEPTION 'Studio draft identity cannot change' USING ERRCODE='42501';
 END IF;
 IF NEW.handoff_rules->>'studio_version'='phase36' THEN
  IF NEW.enabled IS DISTINCT FROM false OR cardinality(NEW.channels)<>0 OR jsonb_typeof(NEW.steps)<>'array' OR NEW.handoff_rules->'full_flow'->'nodes' IS DISTINCT FROM NEW.steps THEN RAISE EXCEPTION 'Studio workflows must retain their complete disabled graph' USING ERRCODE='23514'; END IF;
  IF coalesce(NEW.handoff_rules->>'tenant_id','') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN RAISE EXCEPTION 'Studio tenant required' USING ERRCODE='23514'; END IF;
  IF auth.role()='authenticated' AND (NOT public.user_has_tenant((NEW.handoff_rules->>'tenant_id')::uuid) OR (TG_OP='INSERT' AND NEW.handoff_rules->>'created_by' IS DISTINCT FROM auth.uid()::text)) THEN RAISE EXCEPTION 'Unauthorized studio draft' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.ac_studio_draft_guard() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ac_studio_draft_guard() TO service_role;
CREATE TRIGGER ac_studio_draft_guard BEFORE INSERT OR UPDATE ON public.ac_bot_flows FOR EACH ROW EXECUTE FUNCTION public.ac_studio_draft_guard();
CREATE POLICY security_v4_studio_draft_read ON public.ac_bot_flows AS RESTRICTIVE FOR SELECT TO authenticated USING (handoff_rules->>'studio_version' IS DISTINCT FROM 'phase36' OR CASE WHEN handoff_rules->>'tenant_id' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN public.user_has_tenant((handoff_rules->>'tenant_id')::uuid) ELSE false END);
CREATE POLICY security_v4_studio_draft_insert ON public.ac_bot_flows AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (handoff_rules->>'studio_version' IS DISTINCT FROM 'phase36' OR CASE WHEN handoff_rules->>'tenant_id' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN public.user_has_tenant((handoff_rules->>'tenant_id')::uuid) ELSE false END);
CREATE POLICY security_v4_studio_draft_update ON public.ac_bot_flows AS RESTRICTIVE FOR UPDATE TO authenticated USING (handoff_rules->>'studio_version' IS DISTINCT FROM 'phase36' OR CASE WHEN handoff_rules->>'tenant_id' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN public.user_has_tenant((handoff_rules->>'tenant_id')::uuid) ELSE false END) WITH CHECK (handoff_rules->>'studio_version' IS DISTINCT FROM 'phase36' OR CASE WHEN handoff_rules->>'tenant_id' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN public.user_has_tenant((handoff_rules->>'tenant_id')::uuid) ELSE false END);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef AND p.prorettype='trigger'::regtype AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE'))) THEN RAISE EXCEPTION 'Trigger execute regression'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','sec_private') AND p.proname IN ('ac_dashboard_kpis','ac_journey_cohorts','ac_portal_deflection','ac_web_click_heatmap','ac_web_click_pages','ac_web_session_events','ac_web_sessions','ac_web_live','ac_web_top_pages','ac_web_live_map','ac_web_breakdown','ac_web_daily_series','ac_web_goals_summary','ac_web_funnel_stats','ac_web_experiment_stats','ac_web_segment_stats','ac_journey_funnel','ac_journey_attribution','ac_portal_deflection_breakdown','ac_journey_attribution_ext') AND p.prosecdef) THEN RAISE EXCEPTION 'Analytics invoker regression'; END IF;
END $$;