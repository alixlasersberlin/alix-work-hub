---
name: ALIX Copilot Steuerzentrale
description: Konfigurationsseite unter /operations/alix-copilot-config mit Datenquellen, Abteilungen, Modulen, Import, Wissensdatenbank, Antwortverhalten und Audit
type: feature
---
- Route: `/operations/alix-copilot-config`, Seite `src/pages/Operation/AlixCopilotConfig.tsx`
- Menü unter OPERATIONS > ALIX KI > „ALIX Copilot Steuerzentrale" (bestehende „ALIX Copilot Konfiguration" bleibt)
- Zugriff: Super Admin, Admin, Geschäftsführung, QM (RLS via `can_manage_copilot_config()`, Delete nur Super Admin auf copilot_sources)
- Tabellen (additiv): copilot_sources, copilot_source_files, copilot_departments, copilot_module_access, copilot_import_jobs, copilot_knowledge_entries, copilot_settings (singleton key='global'), copilot_audit_log
- Audit-Trigger `copilot_audit_trigger_fn` an allen Tabellen außer audit_log
- PDF-Extraktion clientseitig via pdfjs-dist (max 20 MB / 100 Seiten / 200k Zeichen); Text/CSV/JSON ≤ 500 KB inline
- Anbindung an Edge Function `alix-copilot` ist noch nicht erfolgt (UI-Hinweis im Berechtigungs-Tab)
