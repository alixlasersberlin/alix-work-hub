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
