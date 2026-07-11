# ESC Prompt 2 — Persistenz, Signierte Tokens, E-Mail, Audit-Log

Ziel: Das ESC-Modul (aktuell teilweise in localStorage / Mock) auf **persistente Supabase-Speicherung** heben, alle öffentlichen Links über **signierte Tokens** absichern, **E-Mail-Versand** aus dem Modul heraus produktiv machen und ein **vollständiges Audit-Log** aller Terminaktionen einführen.

Spätere Prompts (nicht Teil dieses Umfangs): KI-Planung, Tourenplanung, Ressourcenplanung, QR-Check-in, digitale Unterschrift, WhatsApp/SMS, Google/Microsoft Two-Way-Sync.

---

## 1. Persistente Datenbank

Bereits vorhandene Tabellen werden konsequent genutzt und wo nötig ergänzt:

- `esc_events`, `esc_event_participants`, `esc_event_resources`, `esc_event_types`, `esc_event_emails`
- `esc_departments`, `esc_employee_departments`, `esc_employee_settings`
- `esc_resources`, `esc_email_templates`, `esc_public_bookings`, `esc_ics_tokens`, `esc_audit_log`

Änderungen:
- Alle Hooks (`useAppointments`, `useResources`, `useEmployees`, `useDepartments`, `useEchMessages`) lesen/schreiben ausschließlich gegen Supabase (kein localStorage-Fallback mehr für Produktivdaten).
- ECH-Nachrichten (`src/lib/esc/ech/store.ts`) wandern in eine neue Tabelle `esc_ech_messages` (Kanal, Template-Slug, Empfänger, Body, Status, Retries, Refs, Timestamps).
- ECH-Templates und -Settings ebenfalls in DB (`esc_ech_templates`, Settings als Zeile in `app_settings`).
- RLS: Lesen für authentifizierte Nutzer, Schreiben nur mit passender Rolle (Admin, Super Admin, ESC-Rollen); Public-Endpoints ausschließlich via signierte Tokens.

## 2. Signierte Tokens (öffentliche Links)

Alle „öffentlichen" Termin-URLs (`/appointment/:token`, `.ics`-Feeds, Cancel/Reschedule/QR) werden über kryptografisch signierte Tokens abgesichert.

- Neuer Secret: `ESC_TOKEN_SECRET` (via `generate_secret`).
- Edge Function `esc-token-issue`: erzeugt HMAC-signierte Tokens (Payload: event_id, action, exp).
- Edge Function `esc-token-verify` + `esc-public-appointment`: prüft Signatur, gibt sanitisierte Daten zurück.
- Bestehende `esc_ics_tokens`-Tabelle bekommt Spalten `signature`, `expires_at`, `revoked_at`.
- Client-Utility `publicUrl()` (siehe `src/lib/esc/public-url.ts`) baut Links inkl. Token.
- Öffentliche Seiten (`/appointment/*`, `/ech/feed/*`) rufen ausschließlich die Verify-Function auf – keine direkten DB-Reads.

## 3. E-Mail-Versand (produktiv)

- Neue Edge Function `esc-send-email` nutzt die bestehende Mail-Infrastruktur (`send-mail` / Lovable Emails).
- `sendMessage()` in `src/lib/esc/ech/sender.ts` ruft für Channel `email`/`calendar_invite` die Edge Function statt des simulierten `setTimeout` auf; ICS-Anhang wird mitgeschickt.
- Rendering der Templates (`esc_ech_templates`) inkl. Platzhalter (`{{customer_name}}`, `{{appointment_date}}`, `{{confirmation_link}}` …) läuft serverseitig, damit signierte Tokens nie im Client zusammengebaut werden.
- Zustellstatus (queued/sent/delivered/failed) wird in `esc_ech_messages` fortgeschrieben; Fehler landen im Audit-Log.
- UI: Statusspalten in `EchLayout` zeigen echten Zustand, Retry-Button ruft `esc-send-email` erneut auf.

## 4. Audit-Log

Zentrale Tabelle `esc_audit_log` (bereits vorhanden) wird konsequent befüllt:

- DB-Trigger auf `esc_events`, `esc_event_participants`, `esc_event_resources`, `esc_public_bookings` für INSERT/UPDATE/DELETE (analog zu `finance_audit_trail`).
- App-seitige Ereignisse (E-Mail gesendet, Token ausgestellt/revoziert, Öffentlicher Aufruf einer Termin-URL) schreiben explizit Log-Einträge über eine kleine `logEscAudit()`-Helper.
- Neue Seite `src/pages/esc/AuditLog.tsx` (Route `/esc/audit`), zugänglich für Super Admin / Admin: Filter nach Entity, Aktion, Zeitraum, User, mit Diff-Ansicht (analog zu `pages/Finance/AuditRevision.tsx` und `pages/MailCenter/AuditLog.tsx`).
- Verlinkung in `/esc/einstellungen` unter Bereich „Sicherheit & Revision".

---

## Technische Details

**Migrationen**
1. `esc_ech_messages`, `esc_ech_templates` (mit GRANTs + RLS).
2. Erweiterung `esc_ics_tokens` (signature, expires_at, revoked_at).
3. Trigger-Funktion `esc_audit_trigger()` + Trigger auf die 4 Kern-Tabellen.

**Edge Functions**
- `esc-token-issue`, `esc-token-verify`, `esc-public-appointment`
- `esc-send-email`
Alle mit CORS, Input-Validation (Zod), Fehler-Weitergabe.

**Frontend**
- Hooks auf Supabase umstellen, localStorage-Pfade entfernen (bzw. nur noch als Cache).
- Neue Route `/esc/audit` + Menüeintrag.
- Einstellungen-Seite: Token-Rotation-Button, E-Mail-Test-Button, Link zum Audit-Log.

**Secrets**
- `ESC_TOKEN_SECRET` (generiert)
- Nutzung des bestehenden Mail-Setups (kein neuer Provider-Key nötig).

**Nicht enthalten (spätere Prompts):** KI-Planung, Touren-/Ressourcenplanung, QR-Check-in, digitale Unterschrift, WhatsApp/SMS, Google/MS Two-Way-Sync.
