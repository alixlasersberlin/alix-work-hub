
-- Switch all existing users from sms to email
UPDATE public.user_profiles SET otp_channel = 'email' WHERE otp_channel = 'sms';

-- Change default for new users
ALTER TABLE public.user_profiles ALTER COLUMN otp_channel SET DEFAULT 'email';
