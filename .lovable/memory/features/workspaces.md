---
name: Multi-Mandanten & Workspace-System
description: Workspaces (Verkauf, Buchhaltung, Lager, Fertigung, Operation) mit Workspace-Bar, gefilterter Sidebar und /w/:code Dashboards
type: feature
---
Additiv zum bestehenden Mandanten-System (tenants/TenantSwitcher).

Tabellen: `workspaces`, `workspace_nav_items` (label/path/icon/roles/tenant_codes/sort_order), `user_workspace_access`.
Mandanten: Alix Lasers, Alix Austria, Alix Medical (MED), CMR — inkl. Profilfelder (legal_name, Adresse, Bank, Logo).

Frontend:
- `src/contexts/WorkspaceContext.tsx` — Workspaces + Nav laden, Rollenfilter, `workspaceMode` (localStorage `alixwork.workspaceMode`), aktiver Workspace (`alixwork.currentWorkspaceCode`).
- `src/components/workspace/WorkspaceBar.tsx` — Leiste unter dem Header, Umschalter „Workspace-Navigation / Klassische Navigation“.
- `src/components/workspace/WorkspaceNav.tsx` — ersetzt im Workspace-Modus die klassische Sidebar-Liste (AppLayout, `wsMode`).
- `src/pages/Workspaces/WorkspaceDashboard.tsx` — Route `/w/:code`, KPI-Kacheln + Schnellzugriff.

Regeln: Bestehende Routen/Funktionen bleiben unverändert; klassische Navigation bleibt Default.
