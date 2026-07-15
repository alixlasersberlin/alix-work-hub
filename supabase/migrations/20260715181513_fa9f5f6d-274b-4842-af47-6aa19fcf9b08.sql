
-- Restrict access to sensitive hash columns via column-level privileges.
-- Only service_role (edge functions) can read these hash columns.
-- Authenticated roles retain read access to all other columns; RLS still gates row visibility.

REVOKE SELECT ON public.catalog_share_links FROM authenticated;
GRANT SELECT (
  id, token, item_id, language_code, country_id, recipient_name, recipient_email,
  recipient_phone, channel, expires_at, view_count, last_viewed_at, revoked_at,
  created_by, created_at, updated_at, max_views, last_sent_at
) ON public.catalog_share_links TO authenticated;
-- password_hash intentionally excluded from authenticated SELECT.

REVOKE SELECT ON public.finance_stakeholders FROM authenticated;
GRANT SELECT (
  id, tenant_id, name, email, role, allowed_reports, expires_at, last_access_at,
  access_count, enabled, created_by, created_at, updated_at
) ON public.finance_stakeholders TO authenticated;
-- access_token_hash intentionally excluded from authenticated SELECT.
