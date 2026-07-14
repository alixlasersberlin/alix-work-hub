ALTER TABLE public.mobile_push_subscriptions
  ADD COLUMN IF NOT EXISTS device_name text,
  ADD COLUMN IF NOT EXISTS os text,
  ADD COLUMN IF NOT EXISTS browser text,
  ADD COLUMN IF NOT EXISTS app_version text,
  ADD COLUMN IF NOT EXISTS ip_hint text,
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending','approved','blocked')),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS blocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS blocked_by uuid,
  ADD COLUMN IF NOT EXISTS block_reason text;

UPDATE public.mobile_push_subscriptions SET approval_status='approved', approved_at=created_at
  WHERE approval_status='pending' AND created_at < now() - interval '1 minute';

DROP POLICY IF EXISTS "Admins can view all push subscriptions" ON public.mobile_push_subscriptions;
CREATE POLICY "Admins can view all push subscriptions"
  ON public.mobile_push_subscriptions FOR SELECT
  TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin'));

DROP POLICY IF EXISTS "Admins can update push subscriptions" ON public.mobile_push_subscriptions;
CREATE POLICY "Admins can update push subscriptions"
  ON public.mobile_push_subscriptions FOR UPDATE
  TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin'));

CREATE OR REPLACE FUNCTION public.is_device_active(_sub_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mobile_push_subscriptions
    WHERE id = _sub_id AND approval_status = 'approved' AND blocked_at IS NULL
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_device_active(uuid) TO authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_mps_user_status ON public.mobile_push_subscriptions(user_id, approval_status);