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
- Erweiterungen: Tabs `datev` (EXTF-700-Export, `src/lib/bank/datev.ts`) und `bank-api` (EBICS/Open-Banking-Abruf, Edge Function `bank-api-fetch`, Secret `BANK_API_TOKEN`, Config in `app_settings.bank_api_connections`).
- Automatische Mahn-Eskalation Rücklastschriften: Edge Function `bank-return-dunning-escalate` (Cron 06:15 UTC), Konfiguration in `app_settings.bank_return_dunning_escalation`, Felder `dunning_level`/`last_dunning_at`/`next_dunning_due`/`dunning_paused` in `bank_return_debits`; Einstellungen im Tab Regeln.
- Dashboard-Widget `BankKpiCard` (offene Zuordnungen, Vorschläge, Rücklastschriftquote) für Admin/Super Admin.
