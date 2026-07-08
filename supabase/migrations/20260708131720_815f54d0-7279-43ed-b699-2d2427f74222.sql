
DROP POLICY IF EXISTS "user can update own profile" ON public.user_profiles;

CREATE POLICY "user can update own profile"
ON public.user_profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND NOT (supplier_id             IS DISTINCT FROM (SELECT up.supplier_id             FROM public.user_profiles up WHERE up.id = auth.uid()))
  AND NOT (account_status          IS DISTINCT FROM (SELECT up.account_status          FROM public.user_profiles up WHERE up.id = auth.uid()))
  AND NOT (is_active               IS DISTINCT FROM (SELECT up.is_active               FROM public.user_profiles up WHERE up.id = auth.uid()))
  AND NOT (invitation_status       IS DISTINCT FROM (SELECT up.invitation_status       FROM public.user_profiles up WHERE up.id = auth.uid()))
  AND NOT (password_reset_required IS DISTINCT FROM (SELECT up.password_reset_required FROM public.user_profiles up WHERE up.id = auth.uid()))
  AND NOT (department_id           IS DISTINCT FROM (SELECT up.department_id           FROM public.user_profiles up WHERE up.id = auth.uid()))
  AND NOT (otp_channel             IS DISTINCT FROM (SELECT up.otp_channel             FROM public.user_profiles up WHERE up.id = auth.uid()))
  AND NOT (mfa_enrolled_at         IS DISTINCT FROM (SELECT up.mfa_enrolled_at         FROM public.user_profiles up WHERE up.id = auth.uid()))
  AND NOT (mfa_recovery_codes_hash IS DISTINCT FROM (SELECT up.mfa_recovery_codes_hash FROM public.user_profiles up WHERE up.id = auth.uid()))
  AND NOT (last_otp_verified_at    IS DISTINCT FROM (SELECT up.last_otp_verified_at    FROM public.user_profiles up WHERE up.id = auth.uid()))
  AND NOT (email                   IS DISTINCT FROM (SELECT up.email                   FROM public.user_profiles up WHERE up.id = auth.uid()))
);

-- Defense in depth: also enforce in the self-update trigger (email was already blocked; keep explicit).
CREATE OR REPLACE FUNCTION public.check_user_profile_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.account_status IS DISTINCT FROM OLD.account_status
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.invitation_status IS DISTINCT FROM OLD.invitation_status
     OR NEW.password_reset_required IS DISTINCT FROM OLD.password_reset_required
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.department_id IS DISTINCT FROM OLD.department_id
     OR NEW.last_otp_verified_at IS DISTINCT FROM OLD.last_otp_verified_at
     OR NEW.supplier_id IS DISTINCT FROM OLD.supplier_id
  THEN
    RAISE EXCEPTION 'You are not allowed to modify restricted profile fields. Contact an administrator to change your email address.';
  END IF;

  RETURN NEW;
END;
$function$;
