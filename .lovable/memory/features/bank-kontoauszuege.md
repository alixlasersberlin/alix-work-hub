---
name: Bank & Kontoauszüge
description: Buchhaltungsmodul für Import, Prüfung und Verbuchung von Kontoauszügen unter /finance/kontoauszuege
type: feature
---
- Route: `/finance/kontoauszuege` (Tabs: import, buchungen, offen, verbucht, historie, konten, regeln), nur Admin & Super Admin.
- Tabellen: `bank_accounts`, `bank_imports`, `bank_transactions`, `bank_transaction_matches`, `bank_transaction_allocations`, `bank_import_templates`, `bank_audit_log`; Storage-Bucket `bank-statements` (privat).
- Formate: PDF, CSV, XLS/XLSX, MT940/942, CAMT.052/053/054, XML, TXT, OFX, QIF, DATEV-CSV (`src/lib/bank/parse.ts`).
- Matching-Score 0–100 (`src/lib/bank/matching.ts`): grün ≥95 sicher, gelb Vorschlag, rot offen. Auto-Verbuchung nur wenn am Bankkonto aktiviert.
- Trennung nach `accounting_area` EU/CH über AccountingRegionSwitcher.
- Keine physischen Löschungen: Storno erzeugt Gegenbuchung, alles im `bank_audit_log`. Storno nur Super Admin.
