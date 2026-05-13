
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS mfa_enrolled_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS mfa_recovery_codes_hash text[] NOT NULL DEFAULT '{}';

-- Replace the self-update guard so users may write the two new MFA fields on their own profile
CREATE OR REPLACE FUNCTION public.check_user_profile_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    RAISE EXCEPTION 'You are not allowed to modify restricted profile fields';
  END IF;

  RETURN NEW;
END;
$$;
