-- Restrict client access to sensitive columns on login_sessions and otp_challenges
REVOKE SELECT (session_token) ON public.login_sessions FROM authenticated, anon;
REVOKE SELECT (otp_hash) ON public.otp_challenges FROM authenticated, anon;