---
name: System Health Center
description: Tägliches Health-/Sicherheits-/Performance-System unter /operation/system-health mit Auto-Wartung, Freigabe-Workflow und Cron 03:00 UTC
type: feature
---
# ALIXWORK System Health Center

- Seite: `/operation/system-health` (nur Super Admin), Menü FORT KNOX → „System Health Center".
- Tabellen: `sys_health_runs` (Score 0–100, metrics, breakdown, auto_actions), `sys_health_findings`, `sys_health_approvals`.
- DB-Funktionen (nur service_role): `sys_health_metrics()`, `sys_health_autofix()`, `sys_cron_recent_failures()`.
- Edge Function `system-health-scan` (Cron `alixwork-system-health-daily`, täglich 03:00 UTC; manuell nur Super Admin).
- **Regel:** Automatisch erlaubt sind nur risikoarme Maßnahmen (ANALYZE, Retention-Purge, Backup-Watchdog).
  Strukturelle Änderungen (Index anlegen/löschen, RLS, Schema, Daten löschen) erzeugen NUR einen Eintrag in
  `sys_health_approvals` und werden niemals automatisch ausgeführt.
- Score: 100 minus Strafpunkte (critical 25, high 10, medium 4, low 1). Warn-Mail an Super Admins bei critical oder Score < 50.
- GitHub Action `.github/workflows/daily-quality-scan.yml` (02:30 UTC): tsc, Tests, Build, npm audit, große Dateien.
