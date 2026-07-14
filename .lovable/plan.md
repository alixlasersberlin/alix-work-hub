
# AlixWork Mobile Kalender – Phase 1–3

Neue mobile Route **`/m/kalender`** unter dem bestehenden `/m`-Layout. Die App spiegelt den bestehenden ESC-Teamkalender (`esc_events`) 1:1. Keine parallele Kalenderlogik.

## Was gebaut wird

### Phase 1 – Mobile Kalender-UI (keine neuen Tabellen)
- **`/m/kalender`** – Heute-Ansicht (nächster Termin mit Countdown, Tagesliste, offene Bestätigungen).
- **`/m/kalender/agenda`** – rollierende 7-Tage-Agenda, unendliches Scrollen.
- **`/m/kalender/tag/:datum`** – Tagesansicht mit Zeitachse.
- **`/m/kalender/woche`** – kompakte Wochenübersicht.
- **`/m/kalender/termin/:id`** – Detailseite mit Schnellaktionen (Anrufen, Navigation, Bestätigen, Verspäten, Ticket/Kunde/Auftrag öffnen).
- **`/m/kalender/team`** – Team- und Abteilungsauslastung heute.
- **Datenquelle:** `esc_events`, `esc_departments`, `esc_event_types`, `esc_event_participants`, `esc_resources` via bestehende Hooks (`useAppointments`, `useDepartments`, `useResources`), gefiltert nach `useTenant` und Rollen.
- **Rechte:** bestehende ESC-Permissions (`src/lib/esc/permissions.ts`) unverändert nutzen; Filter „nur eigene / Abteilung / alle" abhängig von Rolle.
- **Realtime:** Supabase-Channel auf `esc_events` – Änderungen sofort sichtbar.

### Phase 2 – Installierbare PWA
- **`public/manifest.webmanifest`** erweitern (Name „AlixWork Kalender", Icons, Theme).
- **Icons** in `public/` (192, 512, maskable, apple-touch).
- **Head-Tags** in `index.html` (Manifest, Theme-Color, Apple-Touch-Icon).
- **Install-Prompt-Komponente** unter `/m/kalender` – `beforeinstallprompt` für Android, iOS-Anleitung (Teilen → Zum Home-Bildschirm), Buttons „Später"/„Nicht mehr anzeigen" persistent in localStorage.
- **Kein neuer Service Worker** für App-Shell-Caching (Regel: nur bei expliziter Offline-Anforderung). Der bestehende `public/push-sw.js` bleibt für Push zuständig.

### Phase 3 – Web-Push + Reminder-Engine
Neue Tabellen (mandantenfähig, RLS, GRANTs):

- `appointment_reminder_rules` – pro `event_type_id` / `department_id`: `minutes_before`, `channel`, `escalation_level`, `active`.
- `appointment_reminders` – geplante Versendungen mit `idempotency_key = event_id|rule_id|user_id|scheduled_at`, Status-Feld (`planned|sent|delivered|opened|failed|cancelled`), `retry_count`.
- `notification_preferences` – pro User: Push/Email/SMS aktiv, Ruhezeiten, Wochenende, Privacy-Mode, Badge.
- `app_notifications` – In-App-Center (Titel, Text, Kategorie, `read_at`, `action_url`).

Bestehende Tabellen wiederverwenden:
- `mobile_push_subscriptions` (existiert) für VAPID-Endpoints.
- `audit_logs` für alle relevanten Aktionen (Bestätigung, Verschiebung, Reminder gesendet).

Edge Functions:
- **`push-vapid-subscribe`** – Endpoint-Registrierung, sichere Ablage in `mobile_push_subscriptions`.
- **`reminder-scheduler`** – Cron alle 60 s: findet fällige `appointment_reminders`, versendet via Web-Push (VAPID), schreibt Status, respektiert Ruhezeiten und Privacy-Mode.
- **`reminder-materializer`** – Cron alle 5 min: erzeugt aus `esc_events` + `appointment_reminder_rules` konkrete `appointment_reminders` (idempotent).
- **`reminder-escalate`** – prüft überfällige, nicht bestätigte/gestartete Termine und triggert Eskalationsstufen.

Secrets (via `generate_secret`): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

Frontend:
- **`/m/kalender/erinnerungen`** – In-App-Benachrichtigungszentrale (jetzt fällig / heute / überfällig / erledigt).
- **`/m/kalender/einstellungen`** – Push aktivieren, Ruhezeiten, Kanäle, Privacy-Mode.
- **Reminder-Overlay** (Stufe 3/4) – Vollbild-Alert bei ≤15 min mit „Öffnen" / „In 5 min erinnern".
- **App-Badge** über `navigator.setAppBadge()` mit Anzahl offener/überfälliger Termine.
- Bestehender `public/push-sw.js` wird genutzt/erweitert für `notificationclick`-Deep-Link zur Terminseite.

## Was NICHT in diesem Wurf enthalten ist
- Capacitor / native Wrapper (Phase 6).
- Offline-Aktionsqueue mit Konfliktauflösung (Phase 4/5 – erst wenn Basis läuft).
- Externe Kalendersynchronisation (Apple/Google/Outlook Export).
- Biometrischer Login / Gerätesperre durch Admin.
- ICS-Feeds, Widgets, Techniker-Route.

Diese Themen sind im Master-Prompt weiterhin dokumentiert und folgen in späteren Phasen.

## Sicherheit
- Alle neuen Tabellen: `authenticated`-scoped RLS via bestehende Security-Definer-Funktionen (`has_role`, `has_tenant_access`).
- Push-Payloads enthalten **keine** Kundennamen – nur neutrale Vorlage („AlixWork: Ein Termin beginnt in 30 Minuten"). Details erst nach Öffnen der App aus DB nachladen.
- VAPID-Keys ausschließlich als Edge-Function-Secrets. Kein Service-Role-Key im Frontend.
- Audit-Log-Einträge für jede Reminder-Versendung, Bestätigung, Verschiebung.

## Reihenfolge der Umsetzung
1. Phase 1 komplett (UI-Routen, Realtime) – sofort testbar.
2. Phase 2 (Manifest, Icons, Install-Prompt) – sofort auf iOS/Android installierbar.
3. Migration für Phase-3-Tabellen (ein Migrations-Call, alle GRANTs + RLS).
4. VAPID-Secrets erzeugen.
5. Edge Functions + Cron-Jobs.
6. Push-UI, Einstellungen, Benachrichtigungszentrale, Overlay, Badge.
7. Rollen-/Sicherheitstest, Playwright-Smoke auf `/m/kalender`.

Nach jeder Phase kurze Rückmeldung und Test, dann weiter.
