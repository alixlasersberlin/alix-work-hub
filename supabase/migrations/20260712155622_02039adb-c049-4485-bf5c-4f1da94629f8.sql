
CREATE OR REPLACE VIEW public.security_findings_trend_30d
WITH (security_invoker = on) AS
SELECT
  date_trunc('day', created_at)::date AS day,
  severity,
  count(*)::int AS cnt
FROM public.security_audit_findings
WHERE created_at >= now() - interval '30 days'
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

GRANT SELECT ON public.security_findings_trend_30d TO authenticated, service_role;

CREATE OR REPLACE VIEW public.security_last_scan_info
WITH (security_invoker = on) AS
SELECT
  max(created_at) AS last_scan_at,
  count(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS findings_last_7d,
  count(*) FILTER (WHERE status = 'open')::int AS findings_open,
  count(*) FILTER (WHERE severity IN ('critical','high') AND status = 'open')::int AS findings_critical_open
FROM public.security_audit_findings;

GRANT SELECT ON public.security_last_scan_info TO authenticated, service_role;
