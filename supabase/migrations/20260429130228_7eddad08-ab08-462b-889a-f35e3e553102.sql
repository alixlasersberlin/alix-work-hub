ALTER TABLE public.user_profiles DISABLE TRIGGER USER;

UPDATE public.user_profiles
SET password_reset_required = false,
    invitation_status = 'accepted'
WHERE lower(email) = lower('l.scheidler@Alix-operation.de');

ALTER TABLE public.user_profiles ENABLE TRIGGER USER;