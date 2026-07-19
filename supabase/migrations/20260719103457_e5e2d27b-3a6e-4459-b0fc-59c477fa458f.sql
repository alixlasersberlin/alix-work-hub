-- Remove anon SELECT on sig_partners — it exposed api_key_hash, webhook_url, contact_email, quotas.
-- Public branding is served through the edge function `sig-public-load` (service role, only branding cols).
DROP POLICY IF EXISTS "Public branding read" ON public.sig_partners;
REVOKE SELECT ON public.sig_partners FROM anon;