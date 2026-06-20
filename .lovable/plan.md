
# ALIX Copilot – Steuerzentrale (additiv)

Es existiert bereits eine schlanke Seite `src/pages/Operation/AlixCopilotKonfiguration.tsx` (Route `/operation/alix-copilot`) mit Snippets in `app_settings`. Wir bauen darauf auf – **keine Strukturen verändern**, alles additiv.

## 1. Datenbank (additiv, neue Tabellen + RLS)

Neue Migration mit folgenden Tabellen (alle mit `created_at`, `updated_at`, `created_by`):

- `copilot_sources` — id, title, description, category, department, source_type (`pdf|docx|xlsx|csv|text|url|module`), file_path, url, status (`active|inactive`), visible_to_copilot (bool), last_import_at, owner_user_id, version, valid_from, valid_to, tags text[]
- `copilot_source_files` — source_id fk, storage_path, filename, mime, size_bytes, pages, extracted_chars
- `copilot_departments` — key (unique: vertrieb, finance, …), label, enabled, search_documents, search_tickets, search_customers, search_devices, search_repairs, search_offers, search_invoices, search_maintenance
- `copilot_module_access` — module_key (unique), label, enabled, read_allowed, write_allowed (default false), data_scope text, role_restrictions text[]
- `copilot_import_jobs` — source_id, filename, category, department, tags text[], status (`pending|approved|rejected|done|error`), recognized_items int, error_message, version, started_by, finished_at
- `copilot_knowledge_entries` — title, content, category, department, priority (`hoch|mittel|niedrig`), source, version, status (`active|inactive|archived`), valid_from, valid_to, responsible_user_id, tags text[]
- `copilot_settings` — singleton row (key=`global`): only_approved_sources, cite_sources, prioritize_internal, prioritize_iso, restrict_customer_data, restrict_finance_data, restrict_pii, mark_uncertain, auto_language, tone (`professional|short|detailed|support|sales`)
- `copilot_audit_log` — entity, entity_id, action, before jsonb, after jsonb, user_id, ip, session_id

GRANTs auf `authenticated` + `service_role` (kein `anon`), RLS aktivieren.

**Policies:**
- Lesen+Schreiben nur für `is_admin()` ODER `has_role('Geschäftsführung')` ODER `has_role('QM')` ODER `has_role('Operations')` (Operations-Rolle existiert ggf. nicht → wir prüfen über is_admin/Geschäftsführung/QM und tolerieren das).
- `copilot_audit_log` nur SELECT für Berechtigte, INSERT nur service_role/Trigger.

Storage-Bucket `copilot-sources` (private) + Policies (Berechtigte können read/write).

Audit-Trigger `copilot_audit_trigger_fn()` an alle Tabellen außer `copilot_audit_log` hängen.

Seed: Departments und Module-Einträge per `INSERT ... ON CONFLICT DO NOTHING` (Migration, einmalig — ist additiv).

## 2. Frontend

Neue Route additiv:
- `/operations/alix-copilot-config` → neue Seite `src/pages/Operation/AlixCopilotConfig.tsx`
- Bestehende `/operation/alix-copilot` bleibt unangetastet.

Menüeintrag unter **OPERATIONS** → „ALIX Copilot Konfiguration" (neuer Eintrag zusätzlich, alter bleibt).

Seite mit Tabs (shadcn `Tabs`):
1. **Übersicht** – KPI-Karten (count(sources active), sum extracted_chars, last import, departments enabled, settings status, failed imports)
2. **Datenquellen** – Tabelle + Dialog (Upload PDF/DOCX/XLSX/CSV, Text, URL, Modul). PDF-Text via vorhandene `pdfjs-dist`-Logik; XLSX/DOCX optional als Roh-Upload nur Metadaten.
3. **Abteilungen** – Karten je Abteilung mit Toggle-Matrix.
4. **Module** – Toggle pro Modul (read/write, role restrictions als Multi-Tag).
5. **KI-Import** – Wizard (file → category → department → tags → preview → approve/reject), History-Tabelle.
6. **Wissensdatenbank** – CRUD inkl. Status, Priorität, Gültigkeit.
7. **Antwortverhalten** – Form auf `copilot_settings`.
8. **Berechtigungen** – Hinweistext + Liste mit Rollen die Zugriff haben (read-only Info).
9. **Audit Log** – Tabelle mit Filter (entity, user, Zeitraum).

Komponenten unterteilt in `src/pages/Operation/copilot/` (Tabs, Dialogs, Hooks).

Zugriffsschutz im Frontend: nur `Super Admin`, `Admin`, `Geschäftsführung`, `QM` → sonst `<Navigate to="/" />`.

Loading-Skeletons, Toasts (sonner), Such-/Filter-Inputs, Status-Badges, Dark/Light kompatibel via design tokens.

## 3. Hinweise

- Keine bestehenden Tabellen, Policies oder Routen werden geändert.
- Keine Edge-Function-Änderungen in diesem Schritt – die spätere Anbindung des Copilot-Backends an diese neuen Tabellen kann in einem Folge-Schritt erfolgen (Hinweis im UI: „Daten werden gesammelt – Copilot-Anbindung erfolgt im nächsten Rollout").
- Mockdaten nur als Seed (Departments/Module-Liste). Alles andere live aus Supabase.

Bestätige bitte mit **OK**, dann lege ich die Migration an und baue die Seite.
