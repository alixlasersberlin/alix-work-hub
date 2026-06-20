# OPERATIONS → Datensicherung

Neues Modul unter `/operation/datensicherung`, additiv, ohne bestehende Strukturen anzufassen. Aurora-Design, responsive.

## Sichtbarkeit / Rechte
- Vollzugriff: `Super Admin`, `Admin`, `Geschäftsführung`
- Nur Lesen: `QM` (als QMB), `IT Administration` (sofern Rolle vorhanden — sonst nur Vollzugriffsrollen)
- Tile in `src/pages/Operation.tsx` nur für berechtigte Rollen anzeigen
- Route in `src/App.tsx` zusätzlich per Rolle gegated

## UI-Struktur (eine Page mit Tabs)
`src/pages/operation/Datensicherung.tsx` mit Aurora `PageHeader` + Tabs:

1. **Dashboard** – KPI-Kacheln (Letztes / Nächstes Backup, GitHub, Hetzner, Speicher, DB-Größe, Uploads, Backup-Status) mit Ampel (🟢🟡🔴).
2. **GitHub** – Repo/Branch/letzter Commit/Autor/Datum + Commit-History; Buttons: Backup, Commit, Push, Pull, Branch wechseln, Tag (v1.0.x autoincrement).
3. **Hetzner** – SSH-Konfiguration (Servername, Host, IP, Port, User, Key-Ref, Backup-Pfad), Status, Speicher, „Verbindung testen".
4. **Vollständige Sicherung** – Buttons: Komplettbackup, DB sichern, Dateien sichern, Quellcode sichern.
5. **Historie** – Tabelle (Datum, Typ, Größe, Status, User) mit Download / Restore / Löschen.
6. **Wiederherstellung** – Auswahl (Gesamt / DB / Dateien / Code) mit Sicherheitsabfrage; davor automatisches Safety-Backup.
7. **Automatische Backups** – Zeitplan (täglich/wöchentlich/monatlich/individuell), Uhrzeit, Aufbewahrung.
8. **Monitoring** – Live-Charts (CPU/RAM/SSD/Netz/DB/Backup) via Recharts.
9. **Audit Trail** – Tabelle aller Aktionen (User, Zeit, Aktion, Ergebnis), ISO-13485-konformes Log.
10. **Benachrichtigungen** – Toggle-Liste pro Event (Erfolg, Fehler, Speicher voll, GitHub/Hetzner unreachable, Restore fertig) per intern + E-Mail.

Komponenten unter `src/components/datensicherung/` (DashboardTab, GithubTab, HetznerTab, FullBackupTab, HistoryTab, RestoreTab, ScheduleTab, MonitoringTab, AuditTab, NotificationsTab) — wiederverwendbare Aurora-Kacheln aus `src/components/infinity/`.

## Backend (nur additiv)

Bestehende Tabellen wiederverwenden, wo möglich:
- `backups_metadata` (existiert) → Historie
- `audit_logs` (existiert) → Audit Trail Quelle (gefiltert auf module = 'datensicherung')

Neue Tabellen (Migration):
- `backup_schedules` – id, schedule_type, cron, time_of_day, retention_days, scope, active, created_by, timestamps
- `backup_settings` – singleton key/value (github_repo, github_branch, hetzner_host, hetzner_port, hetzner_user, hetzner_path, notification_prefs jsonb)
- `backup_notifications` – id, event, channel, recipient, sent_at, status, payload jsonb
- `restore_jobs` – id, scope, status, requested_by, safety_backup_id (FK backups_metadata), started_at, finished_at, message

Alle mit `GRANT`s + RLS (`is_admin() OR has_role('Geschäftsführung')` für Schreibzugriff; QM/IT readonly).

## Edge Functions (neu, additiv)
- `backup-create` – orchestriert Komplettbackup; ruft intern `nightly-backup` + `sync-backup-to-hetzner` Logik
- `backup-restore` – führt Restore aus, legt vorher Safety-Backup an
- `github-status` – liest Repo/Commits via GitHub API (Token `GITHUB_TOKEN`)
- `github-action` – commit/push/pull/tag (über GitHub API)
- `hetzner-status` – HEAD/list gegen S3-Endpoint, Speicher-Info
- `hetzner-test-connection` – einfacher S3 list-Call mit Fehlertext
- `backup-monitor` – aggregiert CPU/RAM/SSD/Net (Mock falls keine Quelle), DB-Größe via `pg_database_size`, Storage-Summen via Supabase

Bestehende Functions (`nightly-backup`, `sync-backup-to-hetzner`) bleiben unverändert.

## Secrets benötigt
- `GITHUB_TOKEN`, `GITHUB_REPO` (z. B. `owner/repo`)
- `HETZNER_S3_*` (bereits vorhanden, wiederverwenden)
- Optionale: `HETZNER_SSH_HOST`, `HETZNER_SSH_USER`, `HETZNER_SSH_KEY` (nur falls echter SSH gewünscht — sonst rein als Anzeige im Settings-UI gespeichert in `backup_settings`)

## Cron
`pg_cron` Jobs für `backup_schedules` (Edge-Function-Aufruf), zusätzlich zur bestehenden nightly-backup.

## Aurora-Design
- `PageHeader` mit Icon `ShieldCheck`
- KPI-Tiles via `src/components/infinity/KpiTile.tsx`
- Status-Pills via `src/components/infinity/StatusBadge.tsx`
- Charts: `recharts` (bereits installiert)

## Was NICHT geändert wird
- Keine bestehenden Tabellen/Policies/Functions/Routen
- Keine Designtokens
- Keine bestehenden Rollen
