-- One-time: set password for office@alix-lasers.at and clear password_reset_required
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'office@alix-lasers.at';
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  UPDATE auth.users
     SET encrypted_password = crypt('AlixLasers2026!', gen_salt('bf')),
         updated_at = now()
   WHERE id = v_user_id;

  ALTER TABLE public.user_profiles DISABLE TRIGGER enforce_user_profile_update_restrictions;
  UPDATE public.user_profiles
     SET password_reset_required = false,
         invitation_status = 'accepted'
   WHERE id = v_user_id;
  ALTER TABLE public.user_profiles ENABLE TRIGGER enforce_user_profile_update_restrictions;
END $$;