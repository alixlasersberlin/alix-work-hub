-- Hide sensitive columns from client (authenticated) reads.
-- Row-level access via RLS remains unchanged; only column-level SELECT is removed.
REVOKE SELECT (session_token) ON public.login_sessions FROM authenticated;
REVOKE SELECT (session_token) ON public.login_sessions FROM anon;

REVOKE SELECT (access_token, refresh_token) ON public.esc_calendar_connections FROM authenticated;
REVOKE SELECT (access_token, refresh_token) ON public.esc_calendar_connections FROM anon;

-- Ensure service_role (edge functions) keeps full access.
GRANT ALL ON public.login_sessions TO service_role;
GRANT ALL ON public.esc_calendar_connections TO service_role;