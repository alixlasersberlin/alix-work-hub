---
name: Finance Phase 11 — Automations & Workflows
description: Rechnungs-Freigaben, Automations-Engine, Freigabe-Inbox, Compliance-Report
type: feature
---
- Neue Tabellen: finance_automations, finance_automation_runs, finance_approvals
- Trigger create_invoice_approval: Eingangsrechnung ab `app_settings.finance.approval.threshold` (Default 1000€) erzeugt automatisch Approval; ab `dual_threshold` (10000€) 4-Augen-Prinzip.
- Edge Functions: finance-automations-engine (Cron 15min), finance-approval-action, finance-compliance-report (CSV-Export aus audit_logs).
- Seiten: /finance/automations, /finance/freigaben, /finance/compliance
- Berechtigungen: Lesen Finance/Admin/Super Admin/GF; Automations editieren nur Admin/Super Admin; DELETE nur Super Admin.
