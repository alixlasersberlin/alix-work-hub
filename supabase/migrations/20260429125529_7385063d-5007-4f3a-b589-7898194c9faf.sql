ALTER TABLE public.user_profiles DISABLE TRIGGER USER;

UPDATE public.user_profiles
SET password_reset_required = true,
    invitation_status = 'pending'
WHERE lower(email) = lower('l.scheidler@Alix-operation.de');

ALTER TABLE public.user_profiles ENABLE TRIGGER USER;