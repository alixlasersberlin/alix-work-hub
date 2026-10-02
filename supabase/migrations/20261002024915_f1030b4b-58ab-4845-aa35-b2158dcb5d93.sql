DO $mig$
DECLARE r record; nq text; nc text; sql text;
  rep text := '((SELECT (NOT public.tenant_scope_restricted())) OR (public.source_to_tenant_code(\1) = ANY (ARRAY(SELECT unnest(public.user_tenant_codes())))))';
  orep text := '((SELECT (NOT public.tenant_scope_restricted())) OR public.order_tenant_scope_ok(\1))';
BEGIN
  FOR r IN SELECT * FROM pg_policies WHERE schemaname='public'
    AND (coalesce(qual,'')||coalesce(with_check,'')) ~ '(tenant_scope_ok\(|^is_fibu_light\(\)$)'
  LOOP
    nq := r.qual; nc := r.with_check;
    IF nq IS NOT NULL THEN
      nq := regexp_replace(nq, '(?<![a-z_.])order_tenant_scope_ok\(([^()]+)\)', orep, 'g');
      nq := regexp_replace(nq, '(?<![a-z_.])tenant_scope_ok\(([^()]+)\)', rep, 'g');
      IF nq = 'is_fibu_light()' THEN nq := '(SELECT public.is_fibu_light())'; END IF;
    END IF;
    IF nc IS NOT NULL THEN
      nc := regexp_replace(nc, '(?<![a-z_.])order_tenant_scope_ok\(([^()]+)\)', orep, 'g');
      nc := regexp_replace(nc, '(?<![a-z_.])tenant_scope_ok\(([^()]+)\)', rep, 'g');
    END IF;
    IF nq IS DISTINCT FROM r.qual OR nc IS DISTINCT FROM r.with_check THEN
      sql := format('ALTER POLICY %I ON public.%I', r.policyname, r.tablename);
      IF nq IS NOT NULL THEN sql := sql || ' USING (' || nq || ')'; END IF;
      IF nc IS NOT NULL THEN sql := sql || ' WITH CHECK (' || nc || ')'; END IF;
      EXECUTE sql;
    END IF;
  END LOOP;
END $mig$;