DO $$
DECLARE r record; nq text; nc text;
BEGIN
  -- 1) Public tables: replace sign-in-only checks with internal staff check
  FOR r IN SELECT * FROM pg_policies WHERE schemaname='public' AND tablename IN
    ('mileage_logs','delivery_status_history','invoice_corrections','delivery_tracking_events','ac_calls','magic_status_log','delivery_returns','ac_channel_members','ac_conversation_assignments','ac_journey_segments','dispatch_ai_suggestions','ac_conversation_events','ac_channels','ac_conversations','delivery_documents','delivery_signatures','delivery_incidents','delivery_photos','ac_contacts')
  LOOP
    nq := replace(r.qual, 'auth.uid() IS NOT NULL', 'public.is_internal_staff()');
    nc := replace(r.with_check, 'auth.uid() IS NOT NULL', 'public.is_internal_staff()');
    IF nq IS DISTINCT FROM r.qual OR nc IS DISTINCT FROM r.with_check THEN
      EXECUTE format('ALTER POLICY %I ON public.%I %s %s', r.policyname, r.tablename,
        CASE WHEN r.qual IS NOT NULL THEN 'USING ('||nq||')' ELSE '' END,
        CASE WHEN r.with_check IS NOT NULL THEN 'WITH CHECK ('||nc||')' ELSE '' END);
    END IF;
  END LOOP;

  -- 2) Storage: tie listed policies to internal staff (suppliers for plm-media)
  FOR r IN SELECT * FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname IN
    ('ph_cat_media_obj_read_auth','news-images authenticated read','cmr_branding_read','cmr_branding_delete','ph_docs_read','ph_docs_update','inbox_media_read','plm_media_select','inbox_media_write','survey_media_read_auth','cmr_branding_update','ph_docs_insert','cmr_branding_insert','inbox_media_update')
  LOOP
    nq := CASE WHEN r.policyname='plm_media_select' THEN 'public.is_internal_or_supplier()' ELSE 'public.is_internal_staff()' END;
    EXECUTE format('ALTER POLICY %I ON storage.objects TO authenticated %s %s', r.policyname,
      CASE WHEN r.qual IS NOT NULL THEN 'USING (('||r.qual||') AND '||nq||')' ELSE '' END,
      CASE WHEN r.with_check IS NOT NULL THEN 'WITH CHECK (('||r.with_check||') AND '||nq||')' ELSE '' END);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "ph_cat_media_obj_read_anon" ON storage.objects;
DROP POLICY IF EXISTS "survey_media_read_public" ON storage.objects;

ALTER POLICY "ws_nav_select" ON public.workspace_nav_items USING (public.is_internal_staff());
ALTER POLICY "workspaces_select" ON public.workspaces USING (public.is_internal_staff());
ALTER POLICY "releases_read_auth" ON public.app_releases USING (public.is_internal_staff());
ALTER POLICY "app_config_read_auth" ON public.mobile_app_config USING (public.is_internal_staff());
ALTER POLICY "Authenticated can read maintenance status" ON public.system_maintenance USING (public.is_internal_staff() OR public.is_portal_customer() OR public.is_supplier());