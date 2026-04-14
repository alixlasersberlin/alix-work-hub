-- Create a security definer function that validates which fields can be updated
CREATE OR REPLACE FUNCTION public.check_user_profile_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If admin, allow all changes
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- For non-admin self-updates, block sensitive field changes
  IF NEW.account_status IS DISTINCT FROM OLD.account_status
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.invitation_status IS DISTINCT FROM OLD.invitation_status
     OR NEW.password_reset_required IS DISTINCT FROM OLD.password_reset_required
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.department_id IS DISTINCT FROM OLD.department_id
     OR NEW.last_otp_verified_at IS DISTINCT FROM OLD.last_otp_verified_at
  THEN
    RAISE EXCEPTION 'You are not allowed to modify restricted profile fields';
  END IF;

  RETURN NEW;
END;
$$;

-- Add trigger to enforce field-level restrictions
CREATE TRIGGER enforce_user_profile_update_restrictions
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.check_user_profile_self_update();