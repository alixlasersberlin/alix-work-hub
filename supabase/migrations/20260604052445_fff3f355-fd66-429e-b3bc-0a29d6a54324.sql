-- 1. Bearer-Token-Spalte schützen (Spalten-Level-Berechtigung)
REVOKE SELECT (review_token) ON public.reviews FROM authenticated;
REVOKE SELECT (review_token) ON public.reviews FROM anon;
-- service_role und Edge Functions behalten weiterhin Zugriff via SECURITY DEFINER / Service Key

-- 2. Realtime-Publikation einschränken (verhindert ungesteuerte Broadcasts)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='orders') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.orders;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='order_status_history') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.order_status_history;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='route_plans') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.route_plans;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='production_orders') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.production_orders;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='lager_devices') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.lager_devices;
  END IF;
END$$;

-- 3. QM-Rolle darf Bugs aktualisieren (analog zu audit_findings / capa_actions)
DROP POLICY IF EXISTS bugs_update_qm ON public.bugs;
CREATE POLICY bugs_update_qm
  ON public.bugs
  FOR UPDATE
  TO authenticated
  USING (public.can_access_qm())
  WITH CHECK (public.can_access_qm());
