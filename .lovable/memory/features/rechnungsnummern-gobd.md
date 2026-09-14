---
name: Rechnungsnummern GoBD / § 14 UStG
description: Monatlicher Nummernkreis YYYY-MM-NNNN plus unveränderliche Beleg-ID, Audit, Migration unter /finance/rechnungsnummern
type: feature
---

- Jede Rechnung (`zoho_invoices`) hat zwei Nummern:
  - **Beleg-ID** (`beleg_id`) = bisherige Nummer (z. B. RE-2026-00012), unveränderlich (DB-Trigger).
  - **Rechnungsnummer** (`legal_invoice_number`) im Format `YYYY-MM-NNNN`, monatlicher Kreis, ab Vergabe gesperrt (`legal_number_locked`).
- Ein gemeinsamer Kreis für alle Mandanten; Anzahlungen (AZ) zählen mit.
- Vergabe serverseitig und transaktionssicher: `assign_invoice_number(invoice_id)` → `next_invoice_number(date)` mit `FOR UPDATE` auf `invoice_number_ranges`.
- Lücken (Storno) werden nie neu vergeben. Ändern nur via `correct_invoice_number()` — nur Super Admin, Begründung Pflicht, Audit.
- Tabellen: `invoice_number_ranges`, `invoice_number_audit`, `invoice_number_migrations`, View `invoice_number_range_overview`.
- Migration: `preview_invoice_renumbering()` (Pflicht-Vorschau) → `run_invoice_renumbering()` (Admin/Super Admin), sortiert nach Rechnungsdatum, Erstellungszeit, alter Nummer.
- UI: `/finance/rechnungsnummern` (Nummernkreise, Migration, Protokoll).
- PDF/E-Mail: „Rechnung Nr. YYYY-MM-NNNN" plus „Beleg-ID: <alt>".
