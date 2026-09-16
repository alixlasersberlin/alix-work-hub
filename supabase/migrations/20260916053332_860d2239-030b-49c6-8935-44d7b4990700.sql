ALTER TABLE public.user_profiles DISABLE TRIGGER USER;
UPDATE public.user_profiles
   SET is_active = false,
       account_status = 'disabled',
       password_reset_required = true,
       updated_at = now()
 WHERE id = 'ceebcae5-7c1c-44b3-b8d1-b22fdd0b7a8d';
ALTER TABLE public.user_profiles ENABLE TRIGGER USER;
DELETE FROM public.user_roles WHERE user_id = 'ceebcae5-7c1c-44b3-b8d1-b22fdd0b7a8d';