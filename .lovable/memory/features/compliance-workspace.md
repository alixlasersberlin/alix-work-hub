---
name: Software & Compliance Workspace (abgeschottet)
description: Eigener Login /compliance-login und abgeschotteter Workspace /software-compliance mit compliance_* Profilfeldern, Projekten, Aufgaben, Reviews, Supplier Requests, Audit Trail
type: feature
---
Kein zweites Auth-System — dieselbe Supabase-Auth wie AlixWork. Zusätzliche Felder in `user_profiles`:
`compliance_access`, `compliance_role`, `compliance_only_user`, `compliance_default_project_id`.

Tabellen: `compliance_projects`, `compliance_project_members`, `compliance_tasks`, `compliance_task_steps`,
`compliance_supplier_requests`, `compliance_audit_log`.
RLS-Helfer (SECURITY DEFINER, nur `authenticated`): `compliance_is_admin()`, `compliance_has_access()`,
`compliance_is_member(uuid)`, `compliance_can_write(uuid)` — Auditor/Supplier sind read-only.
DELETE nur Super Admin.

Frontend: `src/pages/Compliance/*` (ComplianceLogin, Dashboard, MyTasks, TaskDetail, Reviews, Projects,
SupplierRequests, Users, AuditTrail), Shell `src/components/compliance/ComplianceShell.tsx`,
Hook `src/hooks/useComplianceProfile.ts`, Logik `src/lib/compliance/tasks.ts`.

Regeln:
- `compliance_only_user = true` ⇒ Route-Guard in `ProtectedRoute` (App.tsx) erlaubt nur `/software-compliance/*`,
  `/compliance-login`, `/account`, `/logout`, `/passwort-setzen`.
- Fortschritt zählt nur echte Abschlüsse; zurückgestellte Pflichtaufgaben bleiben offen.
- Nächste Aufgabe: Rejected → Critical → In Progress → Ready → Overdue → fällige Wiedervorlage.
- Bestehender AlixWork-Login `/login` bleibt unverändert; Super Admin kann per Header zwischen beiden wechseln.
