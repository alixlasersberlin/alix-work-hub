
CREATE OR REPLACE VIEW public.security_scan_mfa_coverage AS
SELECT r.name AS role,
       COUNT(DISTINCT ur.user_id) AS users,
       COUNT(DISTINCT ums.user_id) AS with_mfa,
       COUNT(DISTINCT ur.user_id) - COUNT(DISTINCT ums.user_id) AS without_mfa
FROM public.roles r
LEFT JOIN public.user_roles ur ON ur.role_id = r.id
LEFT JOIN public.user_mfa_secrets ums ON ums.user_id = ur.user_id
GROUP BY r.name
ORDER BY r.name;

CREATE OR REPLACE VIEW public.security_scan_privileged_no_mfa AS
SELECT DISTINCT ur.user_id, r.name AS role, up.email, up.full_name
FROM public.user_roles ur
JOIN public.roles r ON r.id = ur.role_id
LEFT JOIN public.user_mfa_secrets ums ON ums.user_id = ur.user_id
LEFT JOIN public.user_profiles up ON up.id = ur.user_id
WHERE r.name IN ('Super Admin','Admin','Finance','Order','QM')
  AND ums.user_id IS NULL;

CREATE OR REPLACE VIEW public.security_scan_stale_sessions AS
SELECT ls.user_id, up.email, up.full_name,
       ls.created_at, ls.expires_at, ls.ip_address::text AS ip_address
FROM public.login_sessions ls
LEFT JOIN public.user_profiles up ON up.id = ls.user_id
WHERE ls.is_active = true
  AND ls.created_at < now() - interval '30 days';

ALTER VIEW public.security_scan_mfa_coverage SET (security_invoker = on);
ALTER VIEW public.security_scan_privileged_no_mfa SET (security_invoker = on);
ALTER VIEW public.security_scan_stale_sessions SET (security_invoker = on);

GRANT SELECT ON public.security_scan_mfa_coverage TO authenticated, service_role;
GRANT SELECT ON public.security_scan_privileged_no_mfa TO authenticated, service_role;
GRANT SELECT ON public.security_scan_stale_sessions TO authenticated, service_role;
