
-- Helper: super admin delete policy factory via inline statements
-- =====================================================
-- AFTER SALES
-- =====================================================

-- as_callbacks
DROP POLICY IF EXISTS as_cb_all ON public.as_callbacks;
CREATE POLICY as_cb_select ON public.as_callbacks FOR SELECT USING (has_role('Super Admin') OR has_role('Admin') OR has_role('After Sales') OR has_role('Vertrieb') OR has_role('Service') OR has_role('Order') OR has_role('SACHBEARBEITUNG'));
CREATE POLICY as_cb_insert ON public.as_callbacks FOR INSERT WITH CHECK (has_role('Super Admin') OR has_role('Admin') OR has_role('After Sales') OR has_role('Vertrieb') OR has_role('Service') OR has_role('Order') OR has_role('SACHBEARBEITUNG'));
CREATE POLICY as_cb_update ON public.as_callbacks FOR UPDATE USING (has_role('Super Admin') OR has_role('Admin') OR has_role('After Sales') OR has_role('Vertrieb') OR has_role('Service') OR has_role('Order') OR has_role('SACHBEARBEITUNG')) WITH CHECK (has_role('Super Admin') OR has_role('Admin') OR has_role('After Sales') OR has_role('Vertrieb') OR has_role('Service') OR has_role('Order') OR has_role('SACHBEARBEITUNG'));
CREATE POLICY as_cb_delete_sa ON public.as_callbacks FOR DELETE USING (has_role('Super Admin'));

-- as_checklist_items (SELECT already exists)
DROP POLICY IF EXISTS as_check_write ON public.as_checklist_items;
CREATE POLICY as_check_insert ON public.as_checklist_items FOR INSERT WITH CHECK (has_role('Super Admin') OR has_role('Admin') OR has_role('After Sales') OR has_role('Vertrieb') OR has_role('Marketing') OR has_role('Service') OR has_role('Order') OR has_role('SACHBEARBEITUNG'));
CREATE POLICY as_check_update ON public.as_checklist_items FOR UPDATE USING (has_role('Super Admin') OR has_role('Admin') OR has_role('After Sales') OR has_role('Vertrieb') OR has_role('Marketing') OR has_role('Service') OR has_role('Order') OR has_role('SACHBEARBEITUNG')) WITH CHECK (has_role('Super Admin') OR has_role('Admin') OR has_role('After Sales') OR has_role('Vertrieb') OR has_role('Marketing') OR has_role('Service') OR has_role('Order') OR has_role('SACHBEARBEITUNG'));
CREATE POLICY as_check_delete_sa ON public.as_checklist_items FOR DELETE USING (has_role('Super Admin'));

-- as_mediapaket_status
DROP POLICY IF EXISTS as_media_all ON public.as_mediapaket_status;
CREATE POLICY as_media_select ON public.as_mediapaket_status FOR SELECT USING (has_role('Super Admin') OR has_role('Admin') OR has_role('After Sales') OR has_role('Marketing') OR has_role('Vertrieb') OR has_role('SACHBEARBEITUNG'));
CREATE POLICY as_media_insert ON public.as_mediapaket_status FOR INSERT WITH CHECK (has_role('Super Admin') OR has_role('Admin') OR has_role('After Sales') OR has_role('Marketing') OR has_role('Vertrieb') OR has_role('SACHBEARBEITUNG'));
CREATE POLICY as_media_update ON public.as_mediapaket_status FOR UPDATE USING (has_role('Super Admin') OR has_role('Admin') OR has_role('After Sales') OR has_role('Marketing') OR has_role('Vertrieb') OR has_role('SACHBEARBEITUNG')) WITH CHECK (has_role('Super Admin') OR has_role('Admin') OR has_role('After Sales') OR has_role('Marketing') OR has_role('Vertrieb') OR has_role('SACHBEARBEITUNG'));
CREATE POLICY as_media_delete_sa ON public.as_mediapaket_status FOR DELETE USING (has_role('Super Admin'));

-- as_reminders (SELECT exists)
DROP POLICY IF EXISTS as_rem_write ON public.as_reminders;
CREATE POLICY as_rem_insert ON public.as_reminders FOR INSERT WITH CHECK (has_role('Super Admin') OR has_role('Admin') OR has_role('After Sales'));
CREATE POLICY as_rem_update ON public.as_reminders FOR UPDATE USING (has_role('Super Admin') OR has_role('Admin') OR has_role('After Sales')) WITH CHECK (has_role('Super Admin') OR has_role('Admin') OR has_role('After Sales'));
CREATE POLICY as_rem_delete_sa ON public.as_reminders FOR DELETE USING (has_role('Super Admin'));

-- as_upsell_suggestions
DROP POLICY IF EXISTS as_up_all ON public.as_upsell_suggestions;
CREATE POLICY as_up_select ON public.as_upsell_suggestions FOR SELECT USING (has_role('Super Admin') OR has_role('Admin') OR has_role('After Sales') OR has_role('Vertrieb'));
CREATE POLICY as_up_insert ON public.as_upsell_suggestions FOR INSERT WITH CHECK (has_role('Super Admin') OR has_role('Admin') OR has_role('After Sales') OR has_role('Vertrieb'));
CREATE POLICY as_up_update ON public.as_upsell_suggestions FOR UPDATE USING (has_role('Super Admin') OR has_role('Admin') OR has_role('After Sales') OR has_role('Vertrieb')) WITH CHECK (has_role('Super Admin') OR has_role('Admin') OR has_role('After Sales') OR has_role('Vertrieb'));
CREATE POLICY as_up_delete_sa ON public.as_upsell_suggestions FOR DELETE USING (has_role('Super Admin'));

-- =====================================================
-- CATALOG
-- =====================================================

-- catalog_bundle_items (SELECT exists)
DROP POLICY IF EXISTS bundle_items_write_admin_catalog ON public.catalog_bundle_items;
CREATE POLICY bundle_items_insert ON public.catalog_bundle_items FOR INSERT WITH CHECK (has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog'));
CREATE POLICY bundle_items_update ON public.catalog_bundle_items FOR UPDATE USING (has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog')) WITH CHECK (has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog'));
CREATE POLICY bundle_items_delete_sa ON public.catalog_bundle_items FOR DELETE USING (has_role('Super Admin'));

-- catalog_bundle_price_tiers
DROP POLICY IF EXISTS tiers_write_admin_catalog ON public.catalog_bundle_price_tiers;
CREATE POLICY tiers_insert ON public.catalog_bundle_price_tiers FOR INSERT WITH CHECK (has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog'));
CREATE POLICY tiers_update ON public.catalog_bundle_price_tiers FOR UPDATE USING (has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog')) WITH CHECK (has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog'));
CREATE POLICY tiers_delete_sa ON public.catalog_bundle_price_tiers FOR DELETE USING (has_role('Super Admin'));

-- catalog_bundles
DROP POLICY IF EXISTS bundles_write_admin_catalog ON public.catalog_bundles;
CREATE POLICY bundles_insert ON public.catalog_bundles FOR INSERT WITH CHECK (has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog'));
CREATE POLICY bundles_update ON public.catalog_bundles FOR UPDATE USING (has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog')) WITH CHECK (has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog'));
CREATE POLICY bundles_delete_sa ON public.catalog_bundles FOR DELETE USING (has_role('Super Admin'));

-- catalog_customer_price_group (SELECT exists)
DROP POLICY IF EXISTS cpg_write_catalog ON public.catalog_customer_price_group;
CREATE POLICY cpg_insert ON public.catalog_customer_price_group FOR INSERT WITH CHECK (has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog') OR has_role('Katalog Preise'));
CREATE POLICY cpg_update ON public.catalog_customer_price_group FOR UPDATE USING (has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog') OR has_role('Katalog Preise')) WITH CHECK (has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog') OR has_role('Katalog Preise'));
CREATE POLICY cpg_delete_sa ON public.catalog_customer_price_group FOR DELETE USING (has_role('Super Admin'));

-- catalog_import_jobs_v2
DROP POLICY IF EXISTS cij2_admin_all ON public.catalog_import_jobs_v2;
CREATE POLICY cij2_select ON public.catalog_import_jobs_v2 FOR SELECT USING (has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog'));
CREATE POLICY cij2_insert ON public.catalog_import_jobs_v2 FOR INSERT WITH CHECK (has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog'));
CREATE POLICY cij2_update ON public.catalog_import_jobs_v2 FOR UPDATE USING (has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog')) WITH CHECK (has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog'));
CREATE POLICY cij2_delete_sa ON public.catalog_import_jobs_v2 FOR DELETE USING (has_role('Super Admin'));

-- catalog_import_sources
DROP POLICY IF EXISTS cis_admin_all ON public.catalog_import_sources;
CREATE POLICY cis_select ON public.catalog_import_sources FOR SELECT USING (has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog'));
CREATE POLICY cis_insert ON public.catalog_import_sources FOR INSERT WITH CHECK (has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog'));
CREATE POLICY cis_update ON public.catalog_import_sources FOR UPDATE USING (has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog')) WITH CHECK (has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog'));
CREATE POLICY cis_delete_sa ON public.catalog_import_sources FOR DELETE USING (has_role('Super Admin'));

-- catalog_pdf_templates (SELECT exists)
DROP POLICY IF EXISTS cpt_write_admin ON public.catalog_pdf_templates;
CREATE POLICY cpt_insert ON public.catalog_pdf_templates FOR INSERT WITH CHECK (has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog'));
CREATE POLICY cpt_update ON public.catalog_pdf_templates FOR UPDATE USING (has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog')) WITH CHECK (has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog'));
CREATE POLICY cpt_delete_sa ON public.catalog_pdf_templates FOR DELETE USING (has_role('Super Admin'));

-- catalog_price_group_overrides (SELECT exists)
DROP POLICY IF EXISTS pgo_write_catalog ON public.catalog_price_group_overrides;
CREATE POLICY pgo_insert ON public.catalog_price_group_overrides FOR INSERT WITH CHECK (has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog') OR has_role('Katalog Preise'));
CREATE POLICY pgo_update ON public.catalog_price_group_overrides FOR UPDATE USING (has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog') OR has_role('Katalog Preise')) WITH CHECK (has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog') OR has_role('Katalog Preise'));
CREATE POLICY pgo_delete_sa ON public.catalog_price_group_overrides FOR DELETE USING (has_role('Super Admin'));

-- catalog_price_groups (SELECT exists)
DROP POLICY IF EXISTS pg_write_catalog ON public.catalog_price_groups;
CREATE POLICY pg_insert ON public.catalog_price_groups FOR INSERT WITH CHECK (has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog') OR has_role('Katalog Preise'));
CREATE POLICY pg_update ON public.catalog_price_groups FOR UPDATE USING (has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog') OR has_role('Katalog Preise')) WITH CHECK (has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog') OR has_role('Katalog Preise'));
CREATE POLICY pg_delete_sa ON public.catalog_price_groups FOR DELETE USING (has_role('Super Admin'));

-- catalog_reminder_log_v2
DROP POLICY IF EXISTS crl2_admin_all ON public.catalog_reminder_log_v2;
CREATE POLICY crl2_select ON public.catalog_reminder_log_v2 FOR SELECT USING (has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog'));
CREATE POLICY crl2_insert ON public.catalog_reminder_log_v2 FOR INSERT WITH CHECK (has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog'));
CREATE POLICY crl2_update ON public.catalog_reminder_log_v2 FOR UPDATE USING (has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog')) WITH CHECK (has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog'));
CREATE POLICY crl2_delete_sa ON public.catalog_reminder_log_v2 FOR DELETE USING (has_role('Super Admin'));

-- catalog_reminder_rules
DROP POLICY IF EXISTS crr_admin_all ON public.catalog_reminder_rules;
CREATE POLICY crr_select ON public.catalog_reminder_rules FOR SELECT USING (has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog'));
CREATE POLICY crr_insert ON public.catalog_reminder_rules FOR INSERT WITH CHECK (has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog'));
CREATE POLICY crr_update ON public.catalog_reminder_rules FOR UPDATE USING (has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog')) WITH CHECK (has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog'));
CREATE POLICY crr_delete_sa ON public.catalog_reminder_rules FOR DELETE USING (has_role('Super Admin'));

-- =====================================================
-- ESC
-- =====================================================

DROP POLICY IF EXISTS esc_dept_admin_all ON public.esc_departments;
CREATE POLICY esc_dept_admin_insert ON public.esc_departments FOR INSERT WITH CHECK (esc_is_admin());
CREATE POLICY esc_dept_admin_update ON public.esc_departments FOR UPDATE USING (esc_is_admin()) WITH CHECK (esc_is_admin());
CREATE POLICY esc_dept_delete_sa ON public.esc_departments FOR DELETE USING (has_role('Super Admin'));

DROP POLICY IF EXISTS esc_tpl_admin_all ON public.esc_email_templates;
CREATE POLICY esc_tpl_admin_insert ON public.esc_email_templates FOR INSERT WITH CHECK (esc_is_admin());
CREATE POLICY esc_tpl_admin_update ON public.esc_email_templates FOR UPDATE USING (esc_is_admin()) WITH CHECK (esc_is_admin());
CREATE POLICY esc_tpl_delete_sa ON public.esc_email_templates FOR DELETE USING (has_role('Super Admin'));

DROP POLICY IF EXISTS esc_empdept_admin_all ON public.esc_employee_departments;
CREATE POLICY esc_empdept_admin_insert ON public.esc_employee_departments FOR INSERT WITH CHECK (esc_is_admin());
CREATE POLICY esc_empdept_admin_update ON public.esc_employee_departments FOR UPDATE USING (esc_is_admin()) WITH CHECK (esc_is_admin());
CREATE POLICY esc_empdept_delete_sa ON public.esc_employee_departments FOR DELETE USING (has_role('Super Admin'));

DROP POLICY IF EXISTS esc_evtype_admin_all ON public.esc_event_types;
CREATE POLICY esc_evtype_admin_insert ON public.esc_event_types FOR INSERT WITH CHECK (esc_is_admin());
CREATE POLICY esc_evtype_admin_update ON public.esc_event_types FOR UPDATE USING (esc_is_admin()) WITH CHECK (esc_is_admin());
CREATE POLICY esc_evtype_delete_sa ON public.esc_event_types FOR DELETE USING (has_role('Super Admin'));

DROP POLICY IF EXISTS esc_res_admin_all ON public.esc_resources;
CREATE POLICY esc_res_admin_insert ON public.esc_resources FOR INSERT WITH CHECK (esc_is_admin());
CREATE POLICY esc_res_admin_update ON public.esc_resources FOR UPDATE USING (esc_is_admin()) WITH CHECK (esc_is_admin());
CREATE POLICY esc_res_delete_sa ON public.esc_resources FOR DELETE USING (has_role('Super Admin'));

DROP POLICY IF EXISTS esc_events_admin_all ON public.esc_events;
CREATE POLICY esc_events_admin_insert ON public.esc_events FOR INSERT WITH CHECK (esc_is_admin());
CREATE POLICY esc_events_admin_update ON public.esc_events FOR UPDATE USING (esc_is_admin()) WITH CHECK (esc_is_admin());
CREATE POLICY esc_events_delete_sa ON public.esc_events FOR DELETE USING (has_role('Super Admin'));

DROP POLICY IF EXISTS esc_part_admin_all ON public.esc_event_participants;
DROP POLICY IF EXISTS esc_part_via_event_write ON public.esc_event_participants;
CREATE POLICY esc_part_admin_insert ON public.esc_event_participants FOR INSERT WITH CHECK (esc_is_admin());
CREATE POLICY esc_part_admin_update ON public.esc_event_participants FOR UPDATE USING (esc_is_admin()) WITH CHECK (esc_is_admin());
CREATE POLICY esc_part_via_event_insert ON public.esc_event_participants FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM esc_events e WHERE e.id = esc_event_participants.event_id AND (e.assigned_user_id = auth.uid() OR e.created_by = auth.uid() OR esc_is_department_lead(auth.uid(), e.department_id))));
CREATE POLICY esc_part_via_event_update ON public.esc_event_participants FOR UPDATE USING (EXISTS (SELECT 1 FROM esc_events e WHERE e.id = esc_event_participants.event_id AND (e.assigned_user_id = auth.uid() OR e.created_by = auth.uid() OR esc_is_department_lead(auth.uid(), e.department_id)))) WITH CHECK (EXISTS (SELECT 1 FROM esc_events e WHERE e.id = esc_event_participants.event_id AND (e.assigned_user_id = auth.uid() OR e.created_by = auth.uid() OR esc_is_department_lead(auth.uid(), e.department_id))));
CREATE POLICY esc_part_delete_sa ON public.esc_event_participants FOR DELETE USING (has_role('Super Admin'));

DROP POLICY IF EXISTS esc_evres_admin_all ON public.esc_event_resources;
DROP POLICY IF EXISTS esc_evres_via_event_write ON public.esc_event_resources;
CREATE POLICY esc_evres_admin_insert ON public.esc_event_resources FOR INSERT WITH CHECK (esc_is_admin());
CREATE POLICY esc_evres_admin_update ON public.esc_event_resources FOR UPDATE USING (esc_is_admin()) WITH CHECK (esc_is_admin());
CREATE POLICY esc_evres_via_event_insert ON public.esc_event_resources FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM esc_events e WHERE e.id = esc_event_resources.event_id AND (e.assigned_user_id = auth.uid() OR e.created_by = auth.uid())));
CREATE POLICY esc_evres_via_event_update ON public.esc_event_resources FOR UPDATE USING (EXISTS (SELECT 1 FROM esc_events e WHERE e.id = esc_event_resources.event_id AND (e.assigned_user_id = auth.uid() OR e.created_by = auth.uid()))) WITH CHECK (EXISTS (SELECT 1 FROM esc_events e WHERE e.id = esc_event_resources.event_id AND (e.assigned_user_id = auth.uid() OR e.created_by = auth.uid())));
CREATE POLICY esc_evres_delete_sa ON public.esc_event_resources FOR DELETE USING (has_role('Super Admin'));

DROP POLICY IF EXISTS esc_pub_admin_all ON public.esc_public_bookings;
CREATE POLICY esc_pub_admin_update ON public.esc_public_bookings FOR UPDATE USING (esc_is_admin()) WITH CHECK (esc_is_admin());
CREATE POLICY esc_pub_admin_select ON public.esc_public_bookings FOR SELECT USING (esc_is_admin());
CREATE POLICY esc_pub_delete_sa ON public.esc_public_bookings FOR DELETE USING (has_role('Super Admin'));

DROP POLICY IF EXISTS "esc_signatures admin all" ON public.esc_signatures;
CREATE POLICY "esc_signatures admin update" ON public.esc_signatures FOR UPDATE USING (has_role('Super Admin') OR has_role('Admin')) WITH CHECK (has_role('Super Admin') OR has_role('Admin'));
CREATE POLICY "esc_signatures delete sa" ON public.esc_signatures FOR DELETE USING (has_role('Super Admin'));

-- =====================================================
-- MEDIA PACKAGE (write policies gated by can_write_media_package)
-- =====================================================

DROP POLICY IF EXISTS mpbrand_write ON public.media_package_branding;
CREATE POLICY mpbrand_insert ON public.media_package_branding FOR INSERT WITH CHECK (can_write_media_package(media_package_id));
CREATE POLICY mpbrand_update ON public.media_package_branding FOR UPDATE USING (can_write_media_package(media_package_id)) WITH CHECK (can_write_media_package(media_package_id));
CREATE POLICY mpbrand_delete_sa ON public.media_package_branding FOR DELETE USING (has_role('Super Admin'));

DROP POLICY IF EXISTS mpcontact_write ON public.media_package_contact_data;
CREATE POLICY mpcontact_insert ON public.media_package_contact_data FOR INSERT WITH CHECK (can_write_media_package(media_package_id));
CREATE POLICY mpcontact_update ON public.media_package_contact_data FOR UPDATE USING (can_write_media_package(media_package_id)) WITH CHECK (can_write_media_package(media_package_id));
CREATE POLICY mpcontact_delete_sa ON public.media_package_contact_data FOR DELETE USING (has_role('Super Admin'));

DROP POLICY IF EXISTS mpdev_write ON public.media_package_devices;
CREATE POLICY mpdev_insert ON public.media_package_devices FOR INSERT WITH CHECK (can_write_media_package(media_package_id));
CREATE POLICY mpdev_update ON public.media_package_devices FOR UPDATE USING (can_write_media_package(media_package_id)) WITH CHECK (can_write_media_package(media_package_id));
CREATE POLICY mpdev_delete_sa ON public.media_package_devices FOR DELETE USING (has_role('Super Admin'));

DROP POLICY IF EXISTS mpoh_write ON public.media_package_opening_hours;
CREATE POLICY mpoh_insert ON public.media_package_opening_hours FOR INSERT WITH CHECK (can_write_media_package(media_package_id));
CREATE POLICY mpoh_update ON public.media_package_opening_hours FOR UPDATE USING (can_write_media_package(media_package_id)) WITH CHECK (can_write_media_package(media_package_id));
CREATE POLICY mpoh_delete_sa ON public.media_package_opening_hours FOR DELETE USING (has_role('Super Admin'));

DROP POLICY IF EXISTS mpprices_write ON public.media_package_prices;
CREATE POLICY mpprices_insert ON public.media_package_prices FOR INSERT WITH CHECK (can_write_media_package(media_package_id));
CREATE POLICY mpprices_update ON public.media_package_prices FOR UPDATE USING (can_write_media_package(media_package_id)) WITH CHECK (can_write_media_package(media_package_id));
CREATE POLICY mpprices_delete_sa ON public.media_package_prices FOR DELETE USING (has_role('Super Admin'));

DROP POLICY IF EXISTS mps_write ON public.media_package_services;
CREATE POLICY mps_insert ON public.media_package_services FOR INSERT WITH CHECK (can_write_media_package(media_package_id));
CREATE POLICY mps_update ON public.media_package_services FOR UPDATE USING (can_write_media_package(media_package_id)) WITH CHECK (can_write_media_package(media_package_id));
CREATE POLICY mps_delete_sa ON public.media_package_services FOR DELETE USING (has_role('Super Admin'));

DROP POLICY IF EXISTS mpstudio_write ON public.media_package_studio_data;
CREATE POLICY mpstudio_insert ON public.media_package_studio_data FOR INSERT WITH CHECK (can_write_media_package(media_package_id));
CREATE POLICY mpstudio_update ON public.media_package_studio_data FOR UPDATE USING (can_write_media_package(media_package_id)) WITH CHECK (can_write_media_package(media_package_id));
CREATE POLICY mpstudio_delete_sa ON public.media_package_studio_data FOR DELETE USING (has_role('Super Admin'));

DROP POLICY IF EXISTS mpteam_write ON public.media_package_team_members;
CREATE POLICY mpteam_insert ON public.media_package_team_members FOR INSERT WITH CHECK (can_write_media_package(media_package_id));
CREATE POLICY mpteam_update ON public.media_package_team_members FOR UPDATE USING (can_write_media_package(media_package_id)) WITH CHECK (can_write_media_package(media_package_id));
CREATE POLICY mpteam_delete_sa ON public.media_package_team_members FOR DELETE USING (has_role('Super Admin'));

DROP POLICY IF EXISTS mptreat_write ON public.media_package_treatments;
CREATE POLICY mptreat_insert ON public.media_package_treatments FOR INSERT WITH CHECK (can_write_media_package(media_package_id));
CREATE POLICY mptreat_update ON public.media_package_treatments FOR UPDATE USING (can_write_media_package(media_package_id)) WITH CHECK (can_write_media_package(media_package_id));
CREATE POLICY mptreat_delete_sa ON public.media_package_treatments FOR DELETE USING (has_role('Super Admin'));
