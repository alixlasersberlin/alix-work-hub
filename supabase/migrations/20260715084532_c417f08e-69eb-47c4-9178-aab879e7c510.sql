
ALTER POLICY "bundle_items_delete_sa" ON public.catalog_bundle_items TO authenticated;
ALTER POLICY "bundle_items_insert" ON public.catalog_bundle_items TO authenticated;
ALTER POLICY "bundle_items_read_auth" ON public.catalog_bundle_items TO authenticated;
ALTER POLICY "bundle_items_update" ON public.catalog_bundle_items TO authenticated;

ALTER POLICY "tiers_delete_sa" ON public.catalog_bundle_price_tiers TO authenticated;
ALTER POLICY "tiers_insert" ON public.catalog_bundle_price_tiers TO authenticated;
ALTER POLICY "tiers_read_auth" ON public.catalog_bundle_price_tiers TO authenticated;
ALTER POLICY "tiers_update" ON public.catalog_bundle_price_tiers TO authenticated;

ALTER POLICY "bundles_delete_sa" ON public.catalog_bundles TO authenticated;
ALTER POLICY "bundles_insert" ON public.catalog_bundles TO authenticated;
ALTER POLICY "bundles_read_auth" ON public.catalog_bundles TO authenticated;
ALTER POLICY "bundles_update" ON public.catalog_bundles TO authenticated;

ALTER POLICY "cat_cat_read" ON public.catalog_categories TO authenticated;
ALTER POLICY "cat_country_read" ON public.catalog_countries TO authenticated;
ALTER POLICY "cat_cur_read" ON public.catalog_currencies TO authenticated;

ALTER POLICY "cpg_delete_sa" ON public.catalog_customer_price_group TO authenticated;
ALTER POLICY "cpg_insert" ON public.catalog_customer_price_group TO authenticated;
ALTER POLICY "cpg_update" ON public.catalog_customer_price_group TO authenticated;

ALTER POLICY "cij2_delete_sa" ON public.catalog_import_jobs_v2 TO authenticated;
ALTER POLICY "cij2_insert" ON public.catalog_import_jobs_v2 TO authenticated;
ALTER POLICY "cij2_select" ON public.catalog_import_jobs_v2 TO authenticated;
ALTER POLICY "cij2_update" ON public.catalog_import_jobs_v2 TO authenticated;

ALTER POLICY "cis_delete_sa" ON public.catalog_import_sources TO authenticated;
ALTER POLICY "cis_insert" ON public.catalog_import_sources TO authenticated;
ALTER POLICY "cis_select" ON public.catalog_import_sources TO authenticated;
ALTER POLICY "cis_update" ON public.catalog_import_sources TO authenticated;

ALTER POLICY "cat_lang_read" ON public.catalog_languages TO authenticated;

ALTER POLICY "cpt_delete_sa" ON public.catalog_pdf_templates TO authenticated;
ALTER POLICY "cpt_insert" ON public.catalog_pdf_templates TO authenticated;
ALTER POLICY "cpt_read_auth" ON public.catalog_pdf_templates TO authenticated;
ALTER POLICY "cpt_update" ON public.catalog_pdf_templates TO authenticated;

ALTER POLICY "pgo_delete_sa" ON public.catalog_price_group_overrides TO authenticated;
ALTER POLICY "pgo_insert" ON public.catalog_price_group_overrides TO authenticated;
ALTER POLICY "pgo_update" ON public.catalog_price_group_overrides TO authenticated;

ALTER POLICY "pg_delete_sa" ON public.catalog_price_groups TO authenticated;
ALTER POLICY "pg_insert" ON public.catalog_price_groups TO authenticated;
ALTER POLICY "pg_update" ON public.catalog_price_groups TO authenticated;

ALTER POLICY "crl2_delete_sa" ON public.catalog_reminder_log_v2 TO authenticated;
ALTER POLICY "crl2_insert" ON public.catalog_reminder_log_v2 TO authenticated;
ALTER POLICY "crl2_select" ON public.catalog_reminder_log_v2 TO authenticated;
ALTER POLICY "crl2_update" ON public.catalog_reminder_log_v2 TO authenticated;

ALTER POLICY "crr_delete_sa" ON public.catalog_reminder_rules TO authenticated;
ALTER POLICY "crr_insert" ON public.catalog_reminder_rules TO authenticated;
ALTER POLICY "crr_select" ON public.catalog_reminder_rules TO authenticated;
ALTER POLICY "crr_update" ON public.catalog_reminder_rules TO authenticated;

ALTER POLICY "esc_dept_delete_sa" ON public.esc_departments TO authenticated;
ALTER POLICY "esc_tpl_delete_sa" ON public.esc_email_templates TO authenticated;
ALTER POLICY "esc_empdept_delete_sa" ON public.esc_employee_departments TO authenticated;
ALTER POLICY "esc_part_delete_sa" ON public.esc_event_participants TO authenticated;
ALTER POLICY "esc_part_via_event_insert" ON public.esc_event_participants TO authenticated;
ALTER POLICY "esc_part_via_event_update" ON public.esc_event_participants TO authenticated;
ALTER POLICY "esc_evres_delete_sa" ON public.esc_event_resources TO authenticated;
ALTER POLICY "esc_evres_via_event_insert" ON public.esc_event_resources TO authenticated;
ALTER POLICY "esc_evres_via_event_update" ON public.esc_event_resources TO authenticated;
ALTER POLICY "esc_evtype_delete_sa" ON public.esc_event_types TO authenticated;
ALTER POLICY "esc_events_delete_sa" ON public.esc_events TO authenticated;
ALTER POLICY "esc_pub_admin_select" ON public.esc_public_bookings TO authenticated;
ALTER POLICY "esc_pub_delete_sa" ON public.esc_public_bookings TO authenticated;
ALTER POLICY "esc_res_delete_sa" ON public.esc_resources TO authenticated;

ALTER POLICY "authorized roles can insert finance records" ON public.finance_records TO authenticated;
