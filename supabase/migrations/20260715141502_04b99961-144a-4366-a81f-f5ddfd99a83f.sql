
-- === 1) catalog_share_links: hide password_hash from client roles ===
-- Password verification stays in the edge function (uses service_role which bypasses column grants).
REVOKE SELECT (password_hash) ON public.catalog_share_links FROM anon, authenticated;

-- === 2) Restrict write policies from PUBLIC role to AUTHENTICATED ===

-- as_callbacks
DROP POLICY IF EXISTS as_cb_delete_sa ON public.as_callbacks;
CREATE POLICY as_cb_delete_sa ON public.as_callbacks FOR DELETE TO authenticated USING (has_role('Super Admin'::text));
DROP POLICY IF EXISTS as_cb_insert ON public.as_callbacks;
CREATE POLICY as_cb_insert ON public.as_callbacks FOR INSERT TO authenticated WITH CHECK (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('After Sales'::text) OR has_role('Vertrieb'::text) OR has_role('Service'::text) OR has_role('Order'::text) OR has_role('SACHBEARBEITUNG'::text));
DROP POLICY IF EXISTS as_cb_select ON public.as_callbacks;
CREATE POLICY as_cb_select ON public.as_callbacks FOR SELECT TO authenticated USING (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('After Sales'::text) OR has_role('Vertrieb'::text) OR has_role('Service'::text) OR has_role('Order'::text) OR has_role('SACHBEARBEITUNG'::text));
DROP POLICY IF EXISTS as_cb_update ON public.as_callbacks;
CREATE POLICY as_cb_update ON public.as_callbacks FOR UPDATE TO authenticated USING (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('After Sales'::text) OR has_role('Vertrieb'::text) OR has_role('Service'::text) OR has_role('Order'::text) OR has_role('SACHBEARBEITUNG'::text)) WITH CHECK (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('After Sales'::text) OR has_role('Vertrieb'::text) OR has_role('Service'::text) OR has_role('Order'::text) OR has_role('SACHBEARBEITUNG'::text));

-- as_checklist_items
DROP POLICY IF EXISTS as_check_delete_sa ON public.as_checklist_items;
CREATE POLICY as_check_delete_sa ON public.as_checklist_items FOR DELETE TO authenticated USING (has_role('Super Admin'::text));
DROP POLICY IF EXISTS as_check_insert ON public.as_checklist_items;
CREATE POLICY as_check_insert ON public.as_checklist_items FOR INSERT TO authenticated WITH CHECK (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('After Sales'::text) OR has_role('Vertrieb'::text) OR has_role('Marketing'::text) OR has_role('Service'::text) OR has_role('Order'::text) OR has_role('SACHBEARBEITUNG'::text));
DROP POLICY IF EXISTS as_check_update ON public.as_checklist_items;
CREATE POLICY as_check_update ON public.as_checklist_items FOR UPDATE TO authenticated USING (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('After Sales'::text) OR has_role('Vertrieb'::text) OR has_role('Marketing'::text) OR has_role('Service'::text) OR has_role('Order'::text) OR has_role('SACHBEARBEITUNG'::text)) WITH CHECK (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('After Sales'::text) OR has_role('Vertrieb'::text) OR has_role('Marketing'::text) OR has_role('Service'::text) OR has_role('Order'::text) OR has_role('SACHBEARBEITUNG'::text));

-- as_mediapaket_status
DROP POLICY IF EXISTS as_media_delete_sa ON public.as_mediapaket_status;
CREATE POLICY as_media_delete_sa ON public.as_mediapaket_status FOR DELETE TO authenticated USING (has_role('Super Admin'::text));
DROP POLICY IF EXISTS as_media_insert ON public.as_mediapaket_status;
CREATE POLICY as_media_insert ON public.as_mediapaket_status FOR INSERT TO authenticated WITH CHECK (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('After Sales'::text) OR has_role('Marketing'::text) OR has_role('Vertrieb'::text) OR has_role('SACHBEARBEITUNG'::text));
DROP POLICY IF EXISTS as_media_select ON public.as_mediapaket_status;
CREATE POLICY as_media_select ON public.as_mediapaket_status FOR SELECT TO authenticated USING (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('After Sales'::text) OR has_role('Marketing'::text) OR has_role('Vertrieb'::text) OR has_role('SACHBEARBEITUNG'::text));
DROP POLICY IF EXISTS as_media_update ON public.as_mediapaket_status;
CREATE POLICY as_media_update ON public.as_mediapaket_status FOR UPDATE TO authenticated USING (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('After Sales'::text) OR has_role('Marketing'::text) OR has_role('Vertrieb'::text) OR has_role('SACHBEARBEITUNG'::text)) WITH CHECK (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('After Sales'::text) OR has_role('Marketing'::text) OR has_role('Vertrieb'::text) OR has_role('SACHBEARBEITUNG'::text));

-- as_reminders
DROP POLICY IF EXISTS as_rem_delete_sa ON public.as_reminders;
CREATE POLICY as_rem_delete_sa ON public.as_reminders FOR DELETE TO authenticated USING (has_role('Super Admin'::text));
DROP POLICY IF EXISTS as_rem_insert ON public.as_reminders;
CREATE POLICY as_rem_insert ON public.as_reminders FOR INSERT TO authenticated WITH CHECK (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('After Sales'::text));
DROP POLICY IF EXISTS as_rem_update ON public.as_reminders;
CREATE POLICY as_rem_update ON public.as_reminders FOR UPDATE TO authenticated USING (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('After Sales'::text)) WITH CHECK (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('After Sales'::text));

-- as_upsell_suggestions
DROP POLICY IF EXISTS as_up_delete_sa ON public.as_upsell_suggestions;
CREATE POLICY as_up_delete_sa ON public.as_upsell_suggestions FOR DELETE TO authenticated USING (has_role('Super Admin'::text));
DROP POLICY IF EXISTS as_up_insert ON public.as_upsell_suggestions;
CREATE POLICY as_up_insert ON public.as_upsell_suggestions FOR INSERT TO authenticated WITH CHECK (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('After Sales'::text) OR has_role('Vertrieb'::text));
DROP POLICY IF EXISTS as_up_select ON public.as_upsell_suggestions;
CREATE POLICY as_up_select ON public.as_upsell_suggestions FOR SELECT TO authenticated USING (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('After Sales'::text) OR has_role('Vertrieb'::text));
DROP POLICY IF EXISTS as_up_update ON public.as_upsell_suggestions;
CREATE POLICY as_up_update ON public.as_upsell_suggestions FOR UPDATE TO authenticated USING (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('After Sales'::text) OR has_role('Vertrieb'::text)) WITH CHECK (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('After Sales'::text) OR has_role('Vertrieb'::text));

-- media_package_services
DROP POLICY IF EXISTS mps_delete_sa ON public.media_package_services;
CREATE POLICY mps_delete_sa ON public.media_package_services FOR DELETE TO authenticated USING (has_role('Super Admin'::text));
DROP POLICY IF EXISTS mps_insert ON public.media_package_services;
CREATE POLICY mps_insert ON public.media_package_services FOR INSERT TO authenticated WITH CHECK (can_write_media_package(media_package_id));
DROP POLICY IF EXISTS mps_update ON public.media_package_services;
CREATE POLICY mps_update ON public.media_package_services FOR UPDATE TO authenticated USING (can_write_media_package(media_package_id)) WITH CHECK (can_write_media_package(media_package_id));

-- media_package_studio_data
DROP POLICY IF EXISTS mpstudio_delete_sa ON public.media_package_studio_data;
CREATE POLICY mpstudio_delete_sa ON public.media_package_studio_data FOR DELETE TO authenticated USING (has_role('Super Admin'::text));
DROP POLICY IF EXISTS mpstudio_insert ON public.media_package_studio_data;
CREATE POLICY mpstudio_insert ON public.media_package_studio_data FOR INSERT TO authenticated WITH CHECK (can_write_media_package(media_package_id));
DROP POLICY IF EXISTS mpstudio_update ON public.media_package_studio_data;
CREATE POLICY mpstudio_update ON public.media_package_studio_data FOR UPDATE TO authenticated USING (can_write_media_package(media_package_id)) WITH CHECK (can_write_media_package(media_package_id));

-- user_profiles: update policy
DROP POLICY IF EXISTS "user can update own profile" ON public.user_profiles;
CREATE POLICY "user can update own profile" ON public.user_profiles
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  (auth.uid() = id)
  AND (NOT (supplier_id IS DISTINCT FROM (SELECT up.supplier_id FROM user_profiles up WHERE up.id = auth.uid())))
  AND (NOT (account_status IS DISTINCT FROM (SELECT up.account_status FROM user_profiles up WHERE up.id = auth.uid())))
  AND (NOT (is_active IS DISTINCT FROM (SELECT up.is_active FROM user_profiles up WHERE up.id = auth.uid())))
  AND (NOT (invitation_status IS DISTINCT FROM (SELECT up.invitation_status FROM user_profiles up WHERE up.id = auth.uid())))
  AND (NOT (password_reset_required IS DISTINCT FROM (SELECT up.password_reset_required FROM user_profiles up WHERE up.id = auth.uid())))
  AND (NOT (department_id IS DISTINCT FROM (SELECT up.department_id FROM user_profiles up WHERE up.id = auth.uid())))
  AND (NOT (otp_channel IS DISTINCT FROM (SELECT up.otp_channel FROM user_profiles up WHERE up.id = auth.uid())))
  AND (NOT (mfa_enrolled_at IS DISTINCT FROM (SELECT up.mfa_enrolled_at FROM user_profiles up WHERE up.id = auth.uid())))
  AND (NOT (last_otp_verified_at IS DISTINCT FROM (SELECT up.last_otp_verified_at FROM user_profiles up WHERE up.id = auth.uid())))
  AND (NOT (email IS DISTINCT FROM (SELECT up.email FROM user_profiles up WHERE up.id = auth.uid())))
  AND (NOT (mfa_exempt IS DISTINCT FROM (SELECT up.mfa_exempt FROM user_profiles up WHERE up.id = auth.uid())))
  AND (NOT (mfa_exempt_reason IS DISTINCT FROM (SELECT up.mfa_exempt_reason FROM user_profiles up WHERE up.id = auth.uid())))
  AND (NOT (mfa_exempt_by IS DISTINCT FROM (SELECT up.mfa_exempt_by FROM user_profiles up WHERE up.id = auth.uid())))
  AND (NOT (mfa_grace_until IS DISTINCT FROM (SELECT up.mfa_grace_until FROM user_profiles up WHERE up.id = auth.uid())))
);
