---
name: GoBD Gesamtabschluss (Phase 12)
description: Zentrale automatische GoBD-Prüfung gobd_compliance_check + Seite /finance/gobd/gesamtabschluss, WORM-/Lösch-/Nummernkreis-Guards
type: feature
---

- Seite `/finance/gobd/gesamtabschluss` ruft `gobd_compliance_check()` auf (Trigger-Prüfung, Berechtigungen, Zeilenschutz, Nummern, Konflikte, Sicherungen) und erzeugt einen CSV-Prüfnachweis (protokolliert via `gobd_log_export`).
- Zusätzliche Guards: `trg_worm_finance_audit_trail`, `trg_worm_invoice_number_migrations`, `gobd_number_range_guard` (kein Reset/Löschen von Nummernkreisen), `gobd_period_delete_guard` (geschlossene Perioden nicht löschbar), `gobd_no_delete` auf `gobd_sync_conflicts`.
- Alle Rechte für nicht angemeldete Besucher (anon) auf Finanz-/Protokolltabellen entzogen; `authenticated` hat kein UPDATE/DELETE auf Protokolltabellen.
- Bestand: 7.751 Rechnungen dürfen NICHT rückwirkend umnummeriert werden — Belegidentität bleibt erhalten.
