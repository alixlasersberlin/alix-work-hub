# Mandanten-Datenfilter — Checkliste & Audit

## Pflicht bei jeder neuen Tabelle (`public`)

1. `tenant_id uuid REFERENCES public.tenants(id)` (nullable = konzernweit sichtbar) **oder** `source_system text`.
2. GRANTs: `authenticated` (SELECT/INSERT/UPDATE/DELETE), `service_role` (ALL), `anon` nur bei bewusst öffentlicher Policy.
3. `ALTER TABLE public.<t> ENABLE ROW LEVEL SECURITY;`
4. Drei **RESTRICTIVE** Policies (Vorlage unten).
5. Bei Bezug zu `order_id`/`customer_id`: BEFORE-INSERT-Trigger `set_tenant_from_relation()`.
6. Frontend: `useTenantFilter()` benutzen; neue RPCs mit Parameter `p_tenant_id`.

### Vorlage (tenant_id)

```sql
CREATE POLICY tenant_data_scope_select ON public.<t> AS RESTRICTIVE
  FOR SELECT USING (public.tenant_scope_id_ok(tenant_id));
CREATE POLICY tenant_data_scope_write ON public.<t> AS RESTRICTIVE
  FOR ALL USING (public.tenant_scope_id_ok(tenant_id))
  WITH CHECK (public.tenant_scope_id_ok(tenant_id));
CREATE POLICY tenant_data_scope_delete ON public.<t> AS RESTRICTIVE
  FOR DELETE USING (public.tenant_scope_id_ok(tenant_id));

CREATE TRIGGER trg_<t>_set_tenant BEFORE INSERT ON public.<t>
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_from_relation();
```

### Vorlage (source_system)

```sql
CREATE POLICY tenant_data_scope_select ON public.<t> AS RESTRICTIVE
  FOR SELECT USING (public.tenant_scope_ok(source_system));
-- write/delete analog
```

## Audit — Tabellen ohne Mandanten-Policies finden

```sql
SELECT c.relname AS tabelle,
       EXISTS (SELECT 1 FROM information_schema.columns col
                WHERE col.table_schema='public' AND col.table_name=c.relname
                  AND col.column_name IN ('tenant_id','source_system')) AS hat_scope_spalte,
       (SELECT count(*) FROM pg_policies p
         WHERE p.schemaname='public' AND p.tablename=c.relname
           AND p.policyname LIKE 'tenant_data_scope%') AS scope_policies
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname='public' AND c.relkind='r'
   AND EXISTS (SELECT 1 FROM information_schema.columns col
                WHERE col.table_schema='public' AND col.table_name=c.relname
                  AND col.column_name IN ('tenant_id','source_system'))
   AND (SELECT count(*) FROM pg_policies p
         WHERE p.schemaname='public' AND p.tablename=c.relname
           AND p.policyname LIKE 'tenant_data_scope%') = 0
 ORDER BY 1;
```

Ergebnis = Tabellen mit Scope-Spalte, aber **ohne** restriktive Mandanten-Policies. Diese Liste muss leer sein.
