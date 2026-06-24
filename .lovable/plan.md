# Modul „Offene Anzahlungen" (Finance)

Additives Modul ohne Änderung bestehender Strukturen. Neue Route `/finance/offene-anzahlungen`, neuer Menüeintrag unter FINANCE.

## 1. Datenbank (neue Tabellen, Migration)

**`finance_deposits`** – zentrale Anzahlungs-Registry (eine Zeile pro Anzahlungsrechnung/Anforderung):
- `id, source` (`alixwork` | `zoho`), `source_ref` (Zoho-ID/Doc-Path), `deposit_number`
- `customer_id`, `customer_name`, `company_name`, `contact_name`
- `offer_id`, `order_id`, `order_number`, `invoice_id`, `invoice_number`
- `net_amount`, `vat_amount`, `gross_amount`, `paid_amount`, `open_amount` (generated)
- `currency`, `due_date`, `issue_date`
- `status` (`offen|ueberfaellig|teilweise|gebucht`)
- `release_status` (`nicht_freigegeben|wartet|teilweise|auto_freigegeben|manuell_freigegeben|gesperrt`)
- `finance_lock` bool, `released_at`, `released_by`, `responsible_user_id`, `note`
- `created_at, updated_at, created_by, updated_by`
- Unique `(source, source_ref)` für Idempotenz; Trigger `set_updated_at`.

**`finance_deposit_bookings`** – einzelne Zahlungen:
- `id, deposit_id, booking_date, paid_amount, payment_method` (Überweisung/Bar/EC/Kreditkarte/Sonstige), `payment_reference, proof_file_path, note, booked_by, created_at`.
- AFTER INSERT/DELETE Trigger → aggregiert `paid_amount`, setzt `status`, ruft Freigabe-Prüfung.

**`finance_deposit_history`** – Audit-Log:
- `id, deposit_id, action, old_status, new_status, old_release_status, new_release_status, user_id, note, created_at`.

**`finance_deposit_notifications`** – Outbox für künftige Kanäle (Email/SMS/Teams/Slack/3CX), jetzt nur intern via `mail_internal_messages` falls vorhanden, sonst Eintrag in Outbox.

GRANTS: SELECT/INSERT/UPDATE für `authenticated`, ALL für `service_role`. RLS:
- Lesen: `can_view_finance_module()`
- Schreiben/Buchen: `can_access_finance_module()` (Super Admin, Admin, Finance, Geschäftsführung)
- Sperre setzen: nur Super Admin/Admin/Finance/Geschäftsführung
- DELETE: nur Super Admin

Trigger `apply_deposit_release()` SECURITY DEFINER: prüft Auftrag (nicht storniert, nicht geliefert) + `finance_lock=false` + `open_amount<=0` → setzt `release_status='auto_freigegeben'`, `released_at/by`, schreibt History; bei Teilzahlung → `teilweise`.

Storage Bucket `finance-deposits` (privat) für Belege.

## 2. Zoho-Bridge (additiv)

Neue Edge Function `sync-zoho-deposits`: liest aus bereits importierten `zoho_invoices`/`zoho_recurring_invoices` alle Datensätze, deren `invoice_number` mit `AZ`/`Anzahlung` matcht **oder** `reference_number` einem Order/Offer entspricht, und upsertet sie in `finance_deposits` (`source='zoho'`, `source_ref=zoho_invoice.id`). Bezahlt-Beträge aus Zoho werden in `paid_amount` gespiegelt (nicht in `finance_deposit_bookings`, um echte interne Buchungen sauber zu trennen). Keine Änderung bestehender Sync-Funktionen. Daily Cron 04:15 UTC.

Trigger auf bestehender `order_additional_deposits` / `orders.deposit_amount` (AFTER INSERT/UPDATE) erzeugt/aktualisiert AlixWork-Einträge in `finance_deposits` (`source='alixwork'`).

## 3. UI

Neue Seite `src/pages/Finance/OffeneAnzahlungen.tsx`:
- PageHeader, KPI-Kacheln (9 Karten laut Vorgabe) via Aggregat-Query
- Filterleiste (Kunde/Firma/Status/Release/Quelle/Mitarbeiter/Zeitraum/Betrag/Überfällig/Auftrag/Angebot)
- `InfinityTable` mit allen genannten Spalten, Quell-Badge (AlixWork/Zoho), Status-Badges (Premium Dark/Gold), Fälligkeits-Farben analog `OffenePosten.tsx`
- Aktionen pro Zeile: **Anzahlung buchen** (Dialog), **Sperre toggeln**, **History**, **Beleg öffnen**
- Buchungsdialog: Datum, Betrag, Zahlungsart, Referenz, Belegupload (Storage), Vermerk

Routing: Eintrag in App-Router + Sidebar unter FINANCE („Offene Anzahlungen").

## 4. Notifications

Nach Auto-/Manuell-Freigabe: Insert in `mail_internal_messages` (falls Rolle-Routing vorhanden) an Empfänger mit Rollen *Einkauf, Bestellwesen, Operations, Geschäftsführung*. Bestellwesen-Dashboard Task: Insert in vorhandene Tasks/`mail_tasks` mit Titel „Neue Bestellung freigegeben". Email/SMS/Teams/Slack: Outbox-Tabelle vorbereitet, Versand-Hook leer (TODO-Stub).

## 5. Rollen/Rechte

Nutzt bestehende SECURITY DEFINER Funktionen `can_view_finance_module()` / `can_access_finance_module()`. Keine neuen Rollen.

## 6. Tech-Details

- TypeScript-Hook `useFinanceDeposits` mit React Query
- Buchungsmutation ruft RPC `finance_deposit_book(p_deposit_id, p_amount, p_method, p_ref, p_date, p_proof, p_note)` (SECURITY DEFINER, prüft Rechte, schreibt Booking + History)
- RPC `finance_deposit_set_lock(p_id, p_lock, p_note)`
- RPC `finance_deposit_manual_release(p_id, p_note)`

## Nicht im Scope
- Aktiver Email-/SMS-/Teams-/Slack-Versand (nur Struktur)
- Änderungen an bestehenden Zoho-Sync, Bestell- oder Finance-Workflows
- Mahnprozesse (Architektur vorbereitet)
