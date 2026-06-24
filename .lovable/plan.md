
# Kassenbuch & Buchungsjournal Pro — Plan

Additives Finance-Submodul. **Keine** Änderungen an bestehenden Tabellen, Workflows, RLS, Rollen, Zoho-Sync oder Finance-Logik. Alles neu unter eigenem Namespace `finance_cashbook*`, `finance_journal*`, `finance_bank_postings`, `finance_audit_trail`.

## 1. Menüstruktur (FINANCE & CONTROLLING)

Neue Einträge unter dem bestehenden Finance-Bereich in `src/components/AppLayout.tsx`:

- Kassenbuch → `/finance/kassenbuch`
- Buchungsjournal → `/finance/buchungsjournal`
- Zahlungsübersicht → `/finance/zahlungsuebersicht`
- Bankbuchungen → `/finance/bankbuchungen`
- Export DATEV → `/finance/datev-export` (neue Seite; bestehende Edge Function `finance-datev-export` wird wiederverwendet)
- Audit & Revision → `/finance/audit-revision`

Bestehende Punkte (Dashboard, Offene Anzahlungen, …) bleiben unverändert.

## 2. Neue Datenbankobjekte (Migration)

Alle Tabellen `public.*`, mit GRANTs + RLS. Schreibrechte: Super Admin, Admin, Finance, Geschäftsführung (über bestehende `can_access_finance_module()`). Lese-Rechte über `can_view_finance_module()`.

### Sequenzen
- `finance_cashbook_seq` — Buchungsnummer `KB-YYYY-00001`
- `finance_journal_seq` — Journalnummer `JB-YYYY-000001`
- `finance_cashbook_closure_seq` — `KA-YYYY-0001`

### Tabellen

**finance_cashbook** — Kassenbuch-Einträge
booking_number, booking_date, booking_time, document_number, booking_type ('einnahme'|'ausgabe'), amount_net, amount_vat, vat_rate, amount_gross, payment_method, cost_center, description, reference, customer_id, supplier_id, attachment_path, status ('aktiv'|'storniert'|'korrigiert'), reversed_by, user_id, tenant_id

**finance_cashbook_closures** — Tagesabschluss
closure_number, closure_date, opening_balance, calculated_balance, counted_balance, difference, note, signature_data (base64 PNG), signed_by, signed_at, status ('offen'|'freigegeben'), released_by, released_at

**finance_journal** — Buchungsjournal (append-only)
journal_number, booking_date, booking_time, tenant_id, source_module ('cashbook'|'bank'|'order'|'invoice'|'deposit'|'payment'|'mahnung'|'zoho'|'po'|'credit_note'|'manual'), source_id, source_table, reference, order_number, invoice_number, document_number, customer_id, supplier_id, vorgang, amount_net, amount_vat, amount_gross, payment_method, account, contra_account, description, status ('aktiv'|'storniert'|'korrigiert'), corrects_journal_id, user_id

**finance_bank_postings** — manuelle Bank-Buchungen (zusätzlich zu bestehenden bank_statements)
posting_date, value_date, bank_account_id, posting_type ('eingang'|'ausgang'|'lastschrift'|'ruecklastschrift'|'erstattung'), amount, currency, counterparty, iban, purpose, reference, customer_id, supplier_id, invoice_id, status, user_id

**finance_audit_trail** — eigenes Audit-Log (kein Overlap mit bestehendem `audit_logs`)
module, entity_table, entity_id, action ('insert'|'update'|'delete_logical'|'reverse'|'release'), old_data jsonb, new_data jsonb, user_id, ip_address, user_agent, created_at

### Trigger
- `assign_*_number` Trigger für Cashbook, Journal, Closure
- `trg_cashbook_to_journal`: nach INSERT/UPDATE auf `finance_cashbook` automatisch `finance_journal`-Eintrag
- `trg_bank_posting_to_journal`: dito für `finance_bank_postings`
- `trg_audit_*`: für Cashbook, Journal, Bank, Closure → `finance_audit_trail`
- GoBD: BEFORE DELETE Trigger auf `finance_cashbook` und `finance_journal` → RAISE EXCEPTION (kein physisches Löschen, außer Super Admin via RLS-Service-Role).
- Stornierung: RPC `cashbook_reverse(_id, _reason)` legt Gegenbuchung an und setzt Status auf `storniert`.

### Auto-Verknüpfung in Journal
Optionaler Helfer-RPC `journal_log(...)` als SECURITY DEFINER für Edge Functions (z. B. Zahlungseingang in `finance_transactions` → zusätzlich Journal-Eintrag), **ohne** bestehende Sync-Funktionen zu verändern. Verknüpfung wird vorerst nur für **neue** Buchungen aus dem neuen Modul aktiviert; bestehende Module bleiben unberührt (additiv). Optionaler Backfill-Edge-Function `finance-journal-backfill` (manuell triggerbar) liest read-only aus `finance_transactions`, `finance_deposits`, `finance_bank_lines` und befüllt Journal — ohne Quelltabellen zu ändern.

## 3. Frontend

Neue Pages unter `src/pages/Finance/`:

- `Kassenbuch.tsx` — Tabelle, Neuanlage-Dialog, Storno, Beleg-Upload (Storage-Bucket `finance-cashbook`), Filter (Datum, Typ, Zahlungsart), Summen je Tag/Monat/Jahr, Soll-/Istbestand-Anzeige.
- `KassenbuchAbschluss.tsx` (Dialog) — Tagesabschluss mit Signatur-Pad (`react-signature-canvas` bereits im Projekt? sonst Canvas-Eigenbau).
- `Buchungsjournal.tsx` — read-only Liste mit Filter (Modul, Datum, Mandant, Kunde, Status), Detail-Drawer mit Historie/Korrekturen.
- `Zahlungsuebersicht.tsx` — aggregiert vorhandene Daten (Rechnungen offen, Anzahlungen offen, Eingänge, Bar/Bank). Reine Read-only-Konsolidierung — keine Datenmutationen.
- `Bankbuchungen.tsx` — CRUD auf `finance_bank_postings`, Auto-Matching-Vorschläge zu offenen Rechnungen.
- `DatevExport.tsx` — UI für bestehende Edge Function `finance-datev-export` plus CSV/Excel/PDF-Optionen über Journal.
- `AuditRevision.tsx` — Liste `finance_audit_trail` mit Filter & Diff-Viewer.

Dashboard-KPIs: Erweiterung von `src/pages/Finance/Dashboard.tsx` um Kassenbestand, Bankbestand, Einnahmen/Ausgaben heute/Monat/Jahr (aus neuen Tabellen). Bestehende KPIs bleiben.

## 4. Storage

Neuer privater Bucket `finance-cashbook` für Belege; RLS-Policies auf `storage.objects` analog zu bestehenden Finance-Buckets.

## 5. Edge Functions

- `finance-journal-backfill` (manueller Sync, optional)
- `finance-cashbook-export` (CSV/Excel/PDF)
- Bestehende `finance-datev-export` unverändert wiederverwenden.

## 6. Rollen / RLS

Reuse von `can_access_finance_module()` (Schreiben) und `can_view_finance_module()` (Lesen). DELETE nur Super Admin (Memory-Regel) — aber durch BEFORE-DELETE-Trigger blockiert; Stornierung statt Löschen.

## 7. Nicht-Ziele

- Keine Änderung an `finance_transactions`, `finance_deposits`, `finance_bank_lines`, Zoho-Sync, bestehenden DATEV-Settings.
- Keine Veränderung der bestehenden Menüpunkte / Routen.
- Kein Backfill ohne explizite User-Aktion.

## Lieferreihenfolge

1. Migration (Tabellen, Sequenzen, Trigger, RLS, Storage-Bucket via separate Tool).
2. Routen + Menüeinträge.
3. Pages: Kassenbuch → Buchungsjournal → Bankbuchungen → Zahlungsübersicht → DATEV → Audit.
4. Dashboard-KPI-Erweiterung.
5. Edge Functions (Export/Backfill).

Soll ich so starten?
