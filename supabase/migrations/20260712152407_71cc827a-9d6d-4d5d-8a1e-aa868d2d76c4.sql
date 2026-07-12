
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND pg_get_function_result(p.oid) = 'trigger'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated;', r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role;', r.proname, r.args);
  END LOOP;
END $$;

-- Overview view for Security Center auto-review
CREATE OR REPLACE VIEW public.security_findings_overview AS
SELECT
  id,
  category,
  target,
  severity,
  title,
  detail,
  recommendation,
  status,
  created_at,
  updated_at,
  EXTRACT(EPOCH FROM (now() - created_at))/86400 AS age_days
FROM public.security_audit_findings;

GRANT SELECT ON public.security_findings_overview TO authenticated, service_role;

INSERT INTO public.security_audit_findings (category, target, severity, title, detail, recommendation, status)
VALUES (
  'functions',
  'public.* trigger functions',
  'low',
  'Phase 4: Trigger-Funktionen auf service_role beschränkt',
  'Alle SECURITY DEFINER Trigger-Funktionen im public-Schema dürfen nicht mehr direkt von PUBLIC/anon/authenticated ausgeführt werden; nur service_role behält Direkt-EXECUTE. Trigger-Ausführung bleibt unverändert.',
  'Neue Trigger-Funktionen künftig ausschließlich mit GRANT EXECUTE ... TO service_role versehen.',
  'resolved'
);
