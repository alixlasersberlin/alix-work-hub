-- 1) Scope-Funktionen ---------------------------------------------------

CREATE OR REPLACE FUNCTION public.user_tenant_codes()
RETURNS text[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(array_agg(DISTINCT code), ARRAY[]::text[])
  FROM (
    SELECT t.code
    FROM public.user_tenant_access uta
    JOIN public.tenants t ON t.id = uta.tenant_id
    WHERE uta.user_id = (SELECT auth.uid())
    UNION
    SELECT trim(replace(r.name, 'Mandant ', ''))
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = (SELECT auth.uid()) AND r.name LIKE 'Mandant %'
    UNION
    SELECT 'AT'
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = (SELECT auth.uid()) AND r.name = 'Österreich'
  ) s;
$$;

-- true, wenn der Benutzer überhaupt auf Mandanten eingeschränkt ist
CREATE OR REPLACE FUNCTION public.tenant_scope_restricted()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT NOT public.is_admin()
     AND array_length(public.user_tenant_codes(), 1) IS NOT NULL;
$$;

-- Herkunft (source_system) -> Mandanten-Code
CREATE OR REPLACE FUNCTION public.source_to_tenant_code(_source text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT t.code FROM public.tenants t WHERE t.zoho_source_system = _source LIMIT 1),
    CASE _source
      WHEN 'zoho_eu_1' THEN 'DE'
      WHEN 'zoho_eu_2' THEN 'AT'
      ELSE 'DE'
    END
  );
$$;

-- Zentrale Prüfung für RLS
CREATE OR REPLACE FUNCTION public.tenant_scope_ok(_source text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT (NOT public.tenant_scope_restricted())
      OR public.source_to_tenant_code(_source) = ANY (public.user_tenant_codes());
$$;

GRANT EXECUTE ON FUNCTION public.user_tenant_codes() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.tenant_scope_restricted() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.source_to_tenant_code(text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.tenant_scope_ok(text) TO authenticated, anon, service_role;

-- 2) Restriktive Scope-Policies auf allen Tabellen mit source_system -----

DO $do$
DECLARE
  t text;
  tables text[] := ARRAY[
    'customers','orders','zoho_invoices','zoho_credit_notes','zoho_recurring_invoices',
    'zoho_recurring_profiles','zoho_items','catalog_items','tickets','ticket_messages',
    'ticket_attachments','lager_devices','orders_inbox','orders_missing','finance_documents'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=t AND column_name='source_system'
    ) THEN
      EXECUTE format('DROP POLICY IF EXISTS tenant_data_scope_select ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS tenant_data_scope_write ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS tenant_data_scope_delete ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY tenant_data_scope_select ON public.%I AS RESTRICTIVE FOR SELECT USING (public.tenant_scope_ok(source_system))', t);
      EXECUTE format(
        'CREATE POLICY tenant_data_scope_write ON public.%I AS RESTRICTIVE FOR UPDATE USING (public.tenant_scope_ok(source_system)) WITH CHECK (public.tenant_scope_ok(source_system))', t);
      EXECUTE format(
        'CREATE POLICY tenant_data_scope_delete ON public.%I AS RESTRICTIVE FOR DELETE USING (public.tenant_scope_ok(source_system))', t);
    END IF;
  END LOOP;
END
$do$;

-- 3) Bestehende Österreich-Rollennutzer erhalten Mandanten-Zugriff AT ----

INSERT INTO public.user_tenant_access (user_id, tenant_id)
SELECT DISTINCT ur.user_id, t.id
FROM public.user_roles ur
JOIN public.roles r ON r.id = ur.role_id
CROSS JOIN public.tenants t
WHERE r.name = 'Österreich' AND t.code = 'AT'
ON CONFLICT DO NOTHING;