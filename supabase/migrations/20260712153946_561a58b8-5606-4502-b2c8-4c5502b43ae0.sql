
CREATE OR REPLACE VIEW public.security_scan_bucket_audit AS
SELECT
  b.id,
  b.name,
  b.public,
  b.created_at,
  COALESCE(pc.policy_count, 0) AS policy_count,
  CASE
    WHEN b.public THEN 'public'
    WHEN COALESCE(pc.policy_count, 0) = 0 THEN 'no_policies'
    ELSE 'ok'
  END AS status
FROM storage.buckets b
LEFT JOIN (
  SELECT
    (regexp_matches(qual::text || ' ' || COALESCE(with_check::text,''), 'bucket_id\s*=\s*''([^'']+)''','g'))[1] AS bucket_id,
    COUNT(*) AS policy_count
  FROM pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects'
  GROUP BY 1
) pc ON pc.bucket_id = b.id;

ALTER VIEW public.security_scan_bucket_audit SET (security_invoker = on);
GRANT SELECT ON public.security_scan_bucket_audit TO authenticated, service_role;
