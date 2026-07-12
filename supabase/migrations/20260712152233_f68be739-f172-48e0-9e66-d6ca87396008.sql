
-- 1) Fix search_path on remaining functions
ALTER FUNCTION public.as_set_updated_at() SET search_path = public;
ALTER FUNCTION public.esc_generate_token() SET search_path = public;
ALTER FUNCTION public.format_document_number(text, text, boolean, integer, bigint, integer) SET search_path = public;

-- 2) Revoke PUBLIC execute on all SECURITY DEFINER functions in public,
--    then grant execute only to authenticated + service_role.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid,
           n.nspname,
           p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon;', r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role;', r.proname, r.args);
  END LOOP;
END $$;

-- Log finding
INSERT INTO public.security_audit_findings (category, target, severity, title, detail, recommendation, status)
VALUES (
  'functions',
  'public.* SECURITY DEFINER',
  'medium',
  'Phase 3: Function-Härtung abgeschlossen',
  'search_path=public auf 3 Funktionen gesetzt. PUBLIC/anon EXECUTE auf allen SECURITY DEFINER Funktionen entzogen; nur authenticated + service_role behalten Ausführungsrecht.',
  'Neue SECURITY DEFINER Funktionen künftig mit "SET search_path = public" definieren und PUBLIC EXECUTE nicht erteilen.',
  'resolved'
);
