
-- 1) Tighten always-true RLS policies on As-* tables
DROP POLICY IF EXISTS as_media_all ON public.as_mediapaket_status;
CREATE POLICY as_media_all ON public.as_mediapaket_status
  FOR ALL TO authenticated
  USING (
    public.has_role('Super Admin') OR public.has_role('Admin')
    OR public.has_role('After Sales') OR public.has_role('Marketing')
    OR public.has_role('Vertrieb') OR public.has_role('SACHBEARBEITUNG')
  )
  WITH CHECK (
    public.has_role('Super Admin') OR public.has_role('Admin')
    OR public.has_role('After Sales') OR public.has_role('Marketing')
    OR public.has_role('Vertrieb') OR public.has_role('SACHBEARBEITUNG')
  );

DROP POLICY IF EXISTS as_cb_all ON public.as_callbacks;
CREATE POLICY as_cb_all ON public.as_callbacks
  FOR ALL TO authenticated
  USING (
    public.has_role('Super Admin') OR public.has_role('Admin')
    OR public.has_role('After Sales') OR public.has_role('Vertrieb')
    OR public.has_role('Service') OR public.has_role('Order')
    OR public.has_role('SACHBEARBEITUNG')
  )
  WITH CHECK (
    public.has_role('Super Admin') OR public.has_role('Admin')
    OR public.has_role('After Sales') OR public.has_role('Vertrieb')
    OR public.has_role('Service') OR public.has_role('Order')
    OR public.has_role('SACHBEARBEITUNG')
  );

DROP POLICY IF EXISTS as_up_all ON public.as_upsell_suggestions;
CREATE POLICY as_up_all ON public.as_upsell_suggestions
  FOR ALL TO authenticated
  USING (
    public.has_role('Super Admin') OR public.has_role('Admin')
    OR public.has_role('After Sales') OR public.has_role('Vertrieb')
  )
  WITH CHECK (
    public.has_role('Super Admin') OR public.has_role('Admin')
    OR public.has_role('After Sales') OR public.has_role('Vertrieb')
  );

DROP POLICY IF EXISTS as_tl_insert ON public.as_timeline_events;
CREATE POLICY as_tl_insert ON public.as_timeline_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role('Super Admin') OR public.has_role('Admin')
    OR public.has_role('After Sales') OR public.has_role('Vertrieb')
    OR public.has_role('Marketing') OR public.has_role('Service')
    OR public.has_role('Order') OR public.has_role('SACHBEARBEITUNG')
    OR public.has_role('Kundenservice') OR public.has_role('Auftragsverwaltung')
    OR public.has_role('Geschäftsführung')
  );

-- 2) Switch as_cases_list_v to security_invoker so RLS of underlying tables
--    is evaluated as the calling user (not the view owner).
ALTER VIEW public.as_cases_list_v SET (security_invoker = on);
