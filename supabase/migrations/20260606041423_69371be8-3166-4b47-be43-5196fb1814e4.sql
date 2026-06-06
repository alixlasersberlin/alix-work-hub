REVOKE SELECT (api_key_encrypted) ON public.mail_domains FROM anon, authenticated;
GRANT SELECT (api_key_encrypted) ON public.mail_domains TO service_role;