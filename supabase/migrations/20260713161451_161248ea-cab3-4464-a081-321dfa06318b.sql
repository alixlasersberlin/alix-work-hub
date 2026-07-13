
-- 1) catalog_change_log: only editors/price managers may insert
DROP POLICY IF EXISTS cat_log_insert ON public.catalog_change_log;
CREATE POLICY cat_log_insert ON public.catalog_change_log
  FOR INSERT TO authenticated
  WITH CHECK (public.catalog_can_edit() OR public.catalog_can_manage_prices());

-- 2) catalog_item_snapshots: only editors/price managers may insert
DROP POLICY IF EXISTS cat_snap_insert ON public.catalog_item_snapshots;
CREATE POLICY cat_snap_insert ON public.catalog_item_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (
    public.catalog_can_edit()
    OR public.catalog_can_manage_prices()
    OR public.has_role('Super Admin')
  );

-- 3) esc_audit_log: only ESC admins may insert (still must be themselves)
DROP POLICY IF EXISTS esc_audit_insert_auth ON public.esc_audit_log;
CREATE POLICY esc_audit_insert_admin ON public.esc_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (public.esc_is_admin() AND changed_by = auth.uid());

-- 4) esc_public_bookings: DB-level rate limit for anonymous inserts
CREATE OR REPLACE FUNCTION public.esc_public_bookings_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email_count int;
  v_dept_count  int;
BEGIN
  SELECT count(*) INTO v_email_count
    FROM public.esc_public_bookings
    WHERE lower(customer_email) = lower(NEW.customer_email)
      AND created_at > now() - interval '1 hour';
  IF v_email_count >= 5 THEN
    RAISE EXCEPTION 'Rate limit exceeded: too many booking requests for this email address. Please try again later.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT count(*) INTO v_dept_count
    FROM public.esc_public_bookings
    WHERE department_id = NEW.department_id
      AND created_at > now() - interval '1 minute';
  IF v_dept_count >= 20 THEN
    RAISE EXCEPTION 'Rate limit exceeded: too many booking requests. Please try again later.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_esc_public_bookings_rate_limit ON public.esc_public_bookings;
CREATE TRIGGER trg_esc_public_bookings_rate_limit
  BEFORE INSERT ON public.esc_public_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.esc_public_bookings_rate_limit();

-- 5) Scope SSO/SCIM/role-approval policies explicitly to 'authenticated'
DROP POLICY IF EXISTS "SA manage sso_providers" ON public.sso_providers;
CREATE POLICY "SA manage sso_providers" ON public.sso_providers
  FOR ALL TO authenticated
  USING (public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Super Admin'));

DROP POLICY IF EXISTS "SA manage sso_group_mappings" ON public.sso_group_mappings;
CREATE POLICY "SA manage sso_group_mappings" ON public.sso_group_mappings
  FOR ALL TO authenticated
  USING (public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Super Admin'));

DROP POLICY IF EXISTS "SA manage scim_tokens" ON public.scim_tokens;
CREATE POLICY "SA manage scim_tokens" ON public.scim_tokens
  FOR ALL TO authenticated
  USING (public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Super Admin'));

DROP POLICY IF EXISTS "SA manage approval chains" ON public.role_approval_chains;
CREATE POLICY "SA manage approval chains" ON public.role_approval_chains
  FOR ALL TO authenticated
  USING (public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Super Admin'));

DROP POLICY IF EXISTS "User can read own requests" ON public.role_change_requests;
CREATE POLICY "User can read own requests" ON public.role_change_requests
  FOR SELECT TO authenticated
  USING ((requested_by = auth.uid()) OR (target_user_id = auth.uid()));

DROP POLICY IF EXISTS "Reviewer read own items" ON public.role_recert_items;
CREATE POLICY "Reviewer read own items" ON public.role_recert_items
  FOR SELECT TO authenticated
  USING (reviewer_id = auth.uid());

DROP POLICY IF EXISTS "Reviewer update own items" ON public.role_recert_items;
CREATE POLICY "Reviewer update own items" ON public.role_recert_items
  FOR UPDATE TO authenticated
  USING (reviewer_id = auth.uid())
  WITH CHECK (reviewer_id = auth.uid());

DROP POLICY IF EXISTS "Approver insert own" ON public.role_request_approvals;
CREATE POLICY "Approver insert own" ON public.role_request_approvals
  FOR INSERT TO authenticated
  WITH CHECK (approver_id = auth.uid());

DROP POLICY IF EXISTS "SA read request approvals" ON public.role_request_approvals;
CREATE POLICY "SA read request approvals" ON public.role_request_approvals
  FOR SELECT TO authenticated
  USING (public.has_role('Super Admin') OR (approver_id = auth.uid()));
