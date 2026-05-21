-- 1. user_profiles self-update: block sensitive auth/MFA fields
DROP POLICY IF EXISTS "user can update own profile" ON public.user_profiles;

CREATE POLICY "user can update own profile"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND NOT (supplier_id IS DISTINCT FROM (SELECT up.supplier_id FROM public.user_profiles up WHERE up.id = auth.uid()))
    AND NOT (account_status IS DISTINCT FROM (SELECT up.account_status FROM public.user_profiles up WHERE up.id = auth.uid()))
    AND NOT (is_active IS DISTINCT FROM (SELECT up.is_active FROM public.user_profiles up WHERE up.id = auth.uid()))
    AND NOT (invitation_status IS DISTINCT FROM (SELECT up.invitation_status FROM public.user_profiles up WHERE up.id = auth.uid()))
    AND NOT (password_reset_required IS DISTINCT FROM (SELECT up.password_reset_required FROM public.user_profiles up WHERE up.id = auth.uid()))
    AND NOT (department_id IS DISTINCT FROM (SELECT up.department_id FROM public.user_profiles up WHERE up.id = auth.uid()))
    AND NOT (otp_channel IS DISTINCT FROM (SELECT up.otp_channel FROM public.user_profiles up WHERE up.id = auth.uid()))
    AND NOT (mfa_enrolled_at IS DISTINCT FROM (SELECT up.mfa_enrolled_at FROM public.user_profiles up WHERE up.id = auth.uid()))
    AND NOT (mfa_recovery_codes_hash IS DISTINCT FROM (SELECT up.mfa_recovery_codes_hash FROM public.user_profiles up WHERE up.id = auth.uid()))
    AND NOT (last_otp_verified_at IS DISTINCT FROM (SELECT up.last_otp_verified_at FROM public.user_profiles up WHERE up.id = auth.uid()))
  );

-- 2. production_orders supplier update: also lock seriennummer, anmerkungen, sent_at
DROP POLICY IF EXISTS "suppliers can update own production orders" ON public.production_orders;

CREATE POLICY "suppliers can update own production orders"
  ON public.production_orders
  FOR UPDATE
  TO authenticated
  USING (is_supplier() AND supplier_id = current_supplier_id())
  WITH CHECK (
    is_supplier()
    AND supplier_id = current_supplier_id()
    AND NOT (supplier_id            IS DISTINCT FROM (SELECT po.supplier_id            FROM public.production_orders po WHERE po.id = production_orders.id))
    AND NOT (order_id               IS DISTINCT FROM (SELECT po.order_id               FROM public.production_orders po WHERE po.id = production_orders.id))
    AND NOT (order_number           IS DISTINCT FROM (SELECT po.order_number           FROM public.production_orders po WHERE po.id = production_orders.id))
    AND NOT (production_order_number IS DISTINCT FROM (SELECT po.production_order_number FROM public.production_orders po WHERE po.id = production_orders.id))
    AND NOT (payment_status         IS DISTINCT FROM (SELECT po.payment_status         FROM public.production_orders po WHERE po.id = production_orders.id))
    AND NOT (is_reclamation         IS DISTINCT FROM (SELECT po.is_reclamation         FROM public.production_orders po WHERE po.id = production_orders.id))
    AND NOT (reclamation_reason     IS DISTINCT FROM (SELECT po.reclamation_reason     FROM public.production_orders po WHERE po.id = production_orders.id))
    AND NOT (approval_status        IS DISTINCT FROM (SELECT po.approval_status        FROM public.production_orders po WHERE po.id = production_orders.id))
    AND NOT (approved_by            IS DISTINCT FROM (SELECT po.approved_by            FROM public.production_orders po WHERE po.id = production_orders.id))
    AND NOT (approved_at            IS DISTINCT FROM (SELECT po.approved_at            FROM public.production_orders po WHERE po.id = production_orders.id))
    AND NOT (approval_note          IS DISTINCT FROM (SELECT po.approval_note          FROM public.production_orders po WHERE po.id = production_orders.id))
    AND NOT (invoice_pdf_path       IS DISTINCT FROM (SELECT po.invoice_pdf_path       FROM public.production_orders po WHERE po.id = production_orders.id))
    AND NOT (attachment_pdf_path    IS DISTINCT FROM (SELECT po.attachment_pdf_path    FROM public.production_orders po WHERE po.id = production_orders.id))
    AND NOT (pdf_path               IS DISTINCT FROM (SELECT po.pdf_path               FROM public.production_orders po WHERE po.id = production_orders.id))
    AND NOT (modellname             IS DISTINCT FROM (SELECT po.modellname             FROM public.production_orders po WHERE po.id = production_orders.id))
    AND NOT (farbe                  IS DISTINCT FROM (SELECT po.farbe                  FROM public.production_orders po WHERE po.id = production_orders.id))
    AND NOT (power_handstueck       IS DISTINCT FROM (SELECT po.power_handstueck       FROM public.production_orders po WHERE po.id = production_orders.id))
    AND NOT (bearbeiter             IS DISTINCT FROM (SELECT po.bearbeiter             FROM public.production_orders po WHERE po.id = production_orders.id))
    AND NOT (liefertermin           IS DISTINCT FROM (SELECT po.liefertermin           FROM public.production_orders po WHERE po.id = production_orders.id))
    AND NOT (sonderwuensche         IS DISTINCT FROM (SELECT po.sonderwuensche         FROM public.production_orders po WHERE po.id = production_orders.id))
    AND NOT (seriennummer           IS DISTINCT FROM (SELECT po.seriennummer           FROM public.production_orders po WHERE po.id = production_orders.id))
    AND NOT (anmerkungen            IS DISTINCT FROM (SELECT po.anmerkungen            FROM public.production_orders po WHERE po.id = production_orders.id))
    AND NOT (sent_at                IS DISTINCT FROM (SELECT po.sent_at                FROM public.production_orders po WHERE po.id = production_orders.id))
  );

-- 3. backups bucket: explicit admin UPDATE policy
DROP POLICY IF EXISTS "Admins can update backup files" ON storage.objects;
CREATE POLICY "Admins can update backup files"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'backups' AND public.is_admin())
  WITH CHECK (bucket_id = 'backups' AND public.is_admin());