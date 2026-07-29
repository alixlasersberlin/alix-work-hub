---
name: Finance Phase 3 CH QR + Lastschriften + CAMT.054
description: Schweizer QR-Rechnung, LSV+/BDD-Lastschriften und CAMT.054-Gutschriftsimport unter /finance/qr-rechnung, /finance/ch-lastschriften, /finance/camt054
type: feature
---
Neue Tabellen (accounting_region='CH', RLS via has_finance_region_access):
- `finance_qr_invoices` — QR-IBAN, Ref-Typ QRR/SCOR/NON, Mod-10 rekursive Prüfziffer via `qr_reference_check_digit()`
- `finance_ch_dd_mandates` (LSV+/BDD), `finance_ch_dd_runs` (CHDD-YYYY-0001), `finance_ch_dd_run_items`
- `finance_camt054_notifications` + `_entries` mit Trigger `camt054_match_entry()` (Auto-Match Ref+Betrag → setzt QR-Rechnung auf `bezahlt`)

Edge Functions:
- `finance-qr-generate` — SIX SPC v0200 Payload + QRR-Referenz (auch preview-Modus)
- `finance-ch-dd-export` — pain.008.001.02.ch.03 XML (LSV+/BDD)
- `finance-camt054-import` — parst CAMT.054-XML, Dedupe via SHA-256 file_hash

UI: QRCode-Rendering via `qrcode` npm-lib clientseitig, alle Seiten hinter Region-Guard (nur CH).
