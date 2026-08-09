---
name: Mandanten-Datenfilter (Data Scope)
description: Sichtbarkeit von Daten wird über Mandantenzugriff (user_tenant_access) + RLS gesteuert, nicht über Rollen
type: feature
---
Zwei Ebenen:
1. **Rolle (RBAC)** — was darf ein Benutzer (lesen/schreiben/löschen/exportieren).
2. **Data Scope (Mandant)** — welche Datensätze sieht er.

DB-Funktionen (SECURITY DEFINER, public):
- `user_tenant_codes()` — Codes aus `user_tenant_access` + Altrollen `Mandant XX` und `Österreich`→`AT`.
- `tenant_scope_restricted()` — true, wenn kein Admin UND mindestens eine Mandanten-Zuordnung existiert.
- `source_to_tenant_code(source)` — `zoho_eu_1`→DE, `zoho_eu_2`→AT, NULL/unbekannt→DE.
- `tenant_scope_ok(source)` — zentrale RLS-Prüfung.

Durchsetzung: **RESTRICTIVE** RLS-Policies `tenant_data_scope_select/write/delete` auf allen Tabellen mit `source_system`
(customers, orders, zoho_invoices/credit_notes/recurring_*, zoho_items, catalog_items, tickets + messages/attachments,
lager_devices, orders_inbox, orders_missing, finance_documents). Sie greifen zusätzlich zu bestehenden Policies.

Regeln:
- Admin/Super Admin: kein Filter.
- Benutzer OHNE Mandanten-Zuordnung: kein Filter (Rückwärtskompatibilität).
- Neue Tabellen mit `source_system` immer mit den drei restriktiven Policies versehen.
- Rolle „Österreich“ ist abgelöst: sie mappt nur noch auf Mandant AT. Keine Routen-/Menüsperren mehr
  (`src/lib/at-only-access.ts` entfernt, `useAtRoleOnly()` deprecated/false).
- `useAtOnly()` = Data Scope ist ausschließlich AT (Mandantenzugriff oder Altrolle).
- Verwaltung der Zuordnung: `/workspaces-admin` (Mandanten-Zugriffsmatrix, schreibend nur Super Admin).

## Phase 2 (tenant_id)
- `tenant_scope_id_ok(uuid)` + `tenant_id_for_source(text)`; NULL-tenant_id = für alle sichtbar.
- Spalte `tenant_id` + restriktive Policies auf: offers, repair_orders, sales_leads, production_orders,
  delivery_tours, delivery_appointments, alixdocs2_documents, alixdocs_documents.
- BEFORE-INSERT-Trigger `set_tenant_from_relation()` setzt tenant_id aus order_id/customer_id
  (offers, repair_orders, production_orders, delivery_appointments).
- Verwaltung: `/admin/rollen-freigaben/datenbereich` (Mandanten-Matrix je Benutzer, Super Admin).

## Pflicht-Checkliste für JEDE neue Tabelle (Prozessregel)
Jede neue Tabelle im Schema `public`, die Geschäftsdaten hält, MUSS im selben Migrationsschritt:
1. Spalte `tenant_id uuid REFERENCES public.tenants(id)` (nullable = konzernweit sichtbar) ODER `source_system text`.
2. GRANTs (`authenticated`, `service_role`; `anon` nur bei bewusst öffentlicher Policy).
3. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.
4. Die drei RESTRICTIVE Policies:
   - `tenant_data_scope_select` … `FOR SELECT USING (public.tenant_scope_id_ok(tenant_id))`
   - `tenant_data_scope_write` … `FOR ALL USING/WITH CHECK (public.tenant_scope_id_ok(tenant_id))`
   - `tenant_data_scope_delete` … `FOR DELETE USING (public.tenant_scope_id_ok(tenant_id))`
   (bei `source_system`-Tabellen stattdessen `public.tenant_scope_ok(source_system)`).
5. Falls die Tabelle an `order_id`/`customer_id` hängt: BEFORE-INSERT-Trigger `set_tenant_from_relation()`.
6. Im Frontend: `useTenantFilter()` verwenden statt ungefilterter Queries; RPCs bekommen `p_tenant_id`.

Audit-Abfrage für Lücken siehe `docs/tenant-scope-checklist.md`.
