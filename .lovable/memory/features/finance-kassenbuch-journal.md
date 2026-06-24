---
name: Kassenbuch & Buchungsjournal Pro
description: GoBD-konformes Kassenbuch, Buchungsjournal, Bankbuchungen, DATEV-Export und Audit-Trail im Finance-Modul
type: feature
---
Additives Submodul unter FINANCE & CONTROLLING. Neue Tabellen ausschließlich:
- `finance_cashbook` (KB-YYYY-00001) + `finance_cashbook_closures` (KA-YYYY-0001)
- `finance_journal` (JB-YYYY-000001) — append-only Buchungsjournal
- `finance_bank_postings` — manuelle Bankbuchungen
- `finance_audit_trail` — eigenes Audit-Log (NICHT `audit_logs`)

Routen: `/finance/kassenbuch`, `/finance/buchungsjournal`, `/finance/zahlungsuebersicht`, `/finance/bankbuchungen`, `/finance/datev-export`, `/finance/audit-revision`.

Regeln:
- Trigger `trg_cashbook_to_journal` / `trg_bankpost_to_journal` schreiben automatisch ins Journal.
- `gobd_block_delete()` verhindert physisches Löschen außer Super Admin.
- Storno via RPC `cashbook_reverse(_id, _reason)` — erzeugt Gegenbuchung und setzt Status `storniert`.
- Bestehender DATEV-Export `finance-datev-export` wird wiederverwendet.
- Storage-Bucket `finance-cashbook` (privat) für Belege.
- Bestehende `finance_transactions`, `finance_deposits`, `finance_bank_lines`, Zoho-Sync NICHT verändert.
