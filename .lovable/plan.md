# Teamkalender systemweit persistieren

Ziel: Alle Änderungen im Teamkalender (Termine, Abteilungen, Mitarbeiter, Fahrzeuge, Räume, Vorführgeräte, Abwesenheiten, Qualifikationen) landen dauerhaft in Supabase und sind für alle Nutzer sichtbar. Bestehende Browser-Daten werden einmalig übernommen und `localStorage` danach geleert.

## Schritte

### 1. Datenbank (Migration)
Bestehende Tabellen weiterverwenden:
- `esc_events` → Termine
- `esc_departments` → Abteilungen
- `esc_resources` → generische Ressourcen (bereits vorhanden, aber unspezifisch)
- `esc_employee_departments`, `esc_employee_settings` → Mitarbeiterzuordnung

Neu anlegen (mit GRANTs + RLS für `authenticated`):
- `rm_locations` (Standorte)
- `rm_qualifications` (Qualifikationen)
- `rm_employees` (Mitarbeiter-Erweiterung: role, location, color, qualifications[], max*)
- `rm_vehicles`
- `rm_rooms`
- `rm_demo_devices`
- `rm_absences`
- `rm_maintenance_tasks`

RLS-Policy pro neuer Tabelle: Lesen/Schreiben für alle eingeloggten Nutzer (`auth.uid() IS NOT NULL`), volle Rechte für `service_role`. Delete zusätzlich nur Super Admin (per `has_role`).

Standard-Seeds (Locations Berlin/Wien/…, Qualifikationen NiSV/Laser/…) werden in der Migration eingespielt, damit die DB nach dem Deploy funktionsfähig ist.

### 2. Hooks umstellen (Frontend)
Jeder Store wird von in-memory/localStorage auf Supabase umgestellt, API-Signaturen (`upsertX`, `removeX`, …) bleiben identisch, damit UI-Komponenten unverändert bleiben:

- `useAppointments` → `esc_events`
- `useDepartments` → `esc_departments`
- `useEmployees` → `esc_employee_settings` + `esc_employee_departments`
- `useResourceMgmt` → neue `rm_*`-Tabellen

Jeder Hook:
1. Initial `select` beim Mount, State in React Query o. `useState`.
2. Realtime-Channel (`postgres_changes`) für Live-Updates aller Sessions.
3. `upsert`/`delete` schreibt direkt in Supabase, Realtime aktualisiert lokal.

### 3. Einmalige Migration der Browser-Daten
Neue Utility `src/lib/esc/migrate-local-to-supabase.ts`:
- Läuft einmal beim ersten Login (Flag `esc.migrated.v1` in `localStorage`).
- Liest bestehende Keys (`esc.employees.v2`, `esc.departments.v2`, evtl. weitere) und ruft die neuen Supabase-`upsert`-Funktionen auf.
- Bei Erfolg: `localStorage.removeItem` für alle migrierten Keys, Flag setzen.
- Trigger im `EscLayout` beim Mount, nur wenn Nutzer eingeloggt.

### 4. Aufräumen
- Mock-Daten (`MOCK_APPOINTMENTS`, `MOCK_EMPLOYEES`, `RM_*`) bleiben nur noch als Seed-Vorlage für die Migration, nicht mehr im Runtime-Pfad.
- Kein `localStorage`-Fallback mehr; bei fehlender Auth zeigt der Kalender leeren Zustand mit Hinweis.

## Technische Details

- Neue Tabellen erhalten `id uuid`, `created_at`, `updated_at`, `created_by uuid` (default `auth.uid()`) plus `update_updated_at_column`-Trigger.
- Realtime wird für alle betroffenen Tabellen per `ALTER PUBLICATION supabase_realtime ADD TABLE …` aktiviert.
- Delete-Restriction Super Admin per Policy `USING (public.has_role(auth.uid(), 'Super Admin'))` gemäß Projekt-Memory.
- Migration nur `CREATE TABLE IF NOT EXISTS` + `INSERT … ON CONFLICT DO NOTHING`, damit sie idempotent bleibt.
- Rollout: Erst Migration ausführen → Types werden regeneriert → dann Hook-Refactor.

## Umfang / Risiken
- Großer Refactor über ~10 Dateien; UI-Komponenten bleiben unverändert.
- Erste Nutzer, die noch Browser-Daten haben, sehen kurz einen Migrations-Toast, danach sind ihre Einträge in Supabase.
- Neue RLS erfordert eingeloggten Nutzer — der öffentliche Buchungsbereich (`/esc/booking`) läuft weiterhin über bestehende Edge-Function-Pfade und wird nicht angerührt.
