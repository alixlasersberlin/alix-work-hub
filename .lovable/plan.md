
# AlixSmart Anmeldestatus – Umsetzungsplan

Großes Modul (20 Punkte). Zerlege ich in 4 Phasen mit klaren Abnahmen. Nach jeder Phase Freigabe, dann geht's weiter.

## Bestandsaufnahme
Vorhanden nutzbar:
- `customers`, `lager_devices` (Seriennummern), `orders`, `alixsmart_products`, `alixsmart_migration_map/logs`
- E-Mail-System (`email_templates`, `email_send_log`, `send-customer-email`)
- SMS via Twilio (`send-customer-sms`, `sms_templates`, `customer_sms_logs`)
- RBAC (`user_roles`, `has_role`), Tenants (`user_tenant_access`), Design-Tokens

Fehlend → neu:
- 5 Tabellen (siehe §19 des Prompts) + RLS + GRANTs
- Edge Functions: `alixsmart-match-run`, `alixsmart-invite-token`, `alixsmart-webhook`, `alixsmart-reminders-cron`
- UI: Dashboard-Kachel, `/kunden/alixsmart-status` (Liste + Detail), Admin-Einstellungen

## Phase 1 – Fundament (DB + Matching-Engine + Basis-UI)
1. Migration: `alixsmart_customer_links`, `alixsmart_device_links`, `alixsmart_registration_invites`, `alixsmart_reminders`, `alixsmart_match_logs` inkl. GRANTs, RLS (nur Admin/Super Admin/Vertrieb, Tenant-Scope).
2. SQL-Funktionen zum Normalisieren (E-Mail lower/trim, Telefon E.164) + Match-Score-View.
3. Edge Function `alixsmart-match-run`: batch-Abgleich Kunden↔AlixSmart-Konten, schreibt `_customer_links` (green/yellow/red) und `_match_logs`.
4. Menü „Kunden → AlixSmart Anmeldestatus" + Seite `/kunden/alixsmart-status` mit Tabelle (Status-Filter, Volltextsuche, InfinityTable), Kachel auf Dashboard.
5. Detailansicht mit Feld-für-Feld-Vergleich (grün/gelb/rot).

**Abnahme:** Alle Kunden mit Seriennummer sichtbar, Statusbuttons korrekt, keine Auto-Zuordnung bei Unsicher.

## Phase 2 – Erinnerungen (Einzel & Bulk)
1. E-Mail-Template `alixsmart_invite` + Button „E-Mail senden" (Vorschau, editierbar).
2. SMS-Template + Button „SMS senden" (deaktiviert ohne Mobil).
3. Individuelle Invite-Tokens: `alixsmart-invite-token` (server-seitig, gehashter Token, TTL, Single/Multi-Use).
4. Stapelaktionen (E-Mail/SMS/Erinnerung planen/erneut prüfen) mit Vorab-Zusammenfassung + Rate-Limit.
5. Logging jeder Aktion in `alixsmart_reminders` + Kundenverlauf.

**Abnahme:** Einzel- + Bulk-Versand funktioniert, Tokens werden serverseitig validiert.

## Phase 3 – Automatik & Webhook
1. Admin-UI `/admin/alixsmart-status` für Erinnerungsserie (Zeitabstände, Kanäle, Vorlagen, Ruhezeiten, Länder-/Geräte-Filter).
2. Cron `alixsmart-reminders-cron` (pg_cron, alle 60 min) – erzeugt/plant Reminder nach Regeln, stoppt bei „Angemeldet".
3. Webhook `alixsmart-webhook` (Endpunkt für AlixSmart-Events: user_registered, device_registered, profile_updated, …) → triggert Match-Run + Statuswechsel.
4. Manueller Button „Jetzt prüfen" pro Kunde.

**Abnahme:** Nach Registrierung wechselt Status automatisch auf „Angemeldet"; Erinnerungen enden.

## Phase 4 – Erweiterungen & Compliance
1. Manuelle Zuordnung / Aufheben mit Bestätigung + Audit.
2. Multi-Device: Status pro Seriennummer + Gesamtstatus, Admin-Option „ein Konto reicht / jede SN nötig".
3. Exporte (CSV/Excel/PDF).
4. Rollen-Feintuning + Feldmaskierung für Non-Admins.
5. Rate-Limits, Audit-Log-Review, DSGVO-Löschpfad.

**Abnahme:** Alle 12 Abnahmekriterien aus Prompt erfüllt.

## Sicherheit
- Alle Tabellen: `ENABLE ROW LEVEL SECURITY`, Policies via `has_role` + `tenant_id`, GRANTs auf `authenticated` + `service_role`.
- Tokens: nur `token_hash` (SHA-256) in DB, Klartext nur einmalig zurückgegeben.
- Keine PII in URLs, keine Seriennummern in Invite-Links.
- Bestehende Module (Design, Auth, Zoho-Sync, Facsimile) bleiben unberührt.

## Start
Ich beginne mit **Phase 1** (DB-Migration + Match-Engine + Basis-UI), sobald du OK gibst. Antworte mit „Phase 1 starten" oder gib Anpassungen an (z. B. Rollen, Cron-Intervall, Match-Schwelle).
