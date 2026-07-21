---
name: ALIX CONNECT Phase 44
description: Compliance Automation 2.0 — DSGVO Auskunft/Löschung + ISO 27001 Evidence-Pack
type: feature
---
- Route `/connect/compliance-automation` (Admin/Super Admin only).
- Edge Function `ac-compliance-automation` (verify_jwt Standard, RBAC via has_role):
  - `dsar_export` aggregiert personenbezogene Daten (customers, tickets, sales_leads, customer_portal_users) per E-Mail.
  - `dsar_erase` (dry_run default true) protokolliert Löschanfrage in audit_logs, echte Löschung bleibt manuell durch Super Admin.
  - `evidence_pack` liefert ISO 27001 Snapshot (Zähler + Controls: RBAC, Encryption, RLS, Audit, Backup, DSAR).
- UI mit Tabs (DSAR / Evidence), JSON-Download.
- Nav-Eintrag „Compliance Automation" in Intelligence-Gruppe.
