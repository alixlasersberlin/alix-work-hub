# Alix Security Center — additive Erweiterung

Ziel: Enterprise-Sicherheitscenter und verdeckte Login-Routen ergänzen, ohne bestehende Tabellen, Rollen, Routen oder den bestehenden `/login`-Flow zu verändern.

## 1. Neue Routen (verdeckt)

Drei zusätzliche Login-Aliasse, die exakt die bestehende `Login.tsx`-Komponente rendern (kein neuer Login-Code, keine Änderung an `useAuth`):

- `/alix-control`
- `/alix-secure`
- `/alix-enterprise`

Maßnahmen:
- `<Helmet>` mit `robots = noindex,nofollow` auf diesen Seiten
- `public/robots.txt` ergänzt um `Disallow: /alix-control`, `/alix-secure`, `/alix-enterprise`
- Keine Menü-Einträge, keine internen Links, keine Sitemap-Einträge

Die bestehende `/login`-Seite bleibt 1:1.

## 2. Menüpunkt „Alix Security Center"

Unter OPERATIONS als neue Kachel, sichtbar nur für `Super Admin`, `Admin`, `Geschäftsführung`. Route: `/operation/security-center`.

Bereiche (read-only Dashboards, keine Mutation existierender Daten):

1. Login-Historie — `login_sessions`
2. Fehlgeschlagene Logins — `audit_logs` action `captcha_failed` + neue `failed_login`-Events
3. Aktive Sitzungen — `login_sessions` mit `revoked_at IS NULL`
4. Gesperrte Benutzer — `user_profiles.account_status != 'active'`
5. Geräteübersicht — Aggregation `login_sessions.user_agent`
6. IP-Übersicht — Aggregation `login_sessions.ip_address` + `audit_logs.ip_address`
7. Sicherheitswarnungen — `audit_logs` mit `_action in ('rate_limit_hit','captcha_failed','admin_login','password_changed','new_device','new_location')`
8. **Alix Security Score** (0–100, Ampel) — berechnet aus:
   - MFA-Verbreitung Admin-Rollen
   - Fehlversuchsrate 24h
   - Anzahl aktiver Sessions älter als 24h
   - Anzahl gesperrter Konten
   - Rate-Limit-Hits 24h

## 3. MFA / TOTP

Bereits implementiert (`Sicherheit.tsx`, `mfa-required.ts`). Im Security Center wird der MFA-Coverage-Status pro Rolle nur angezeigt. Keine Änderung am bestehenden Enforcement.

Hinweis (Doku im UI): unterstützte Apps Microsoft Authenticator / Google Authenticator / Authy — Supabase TOTP ist RFC 6238, alle drei kompatibel.

## 4. Login-Schutz

Bereits vorhanden: Rate-Limit (`check_rate_limit`), Turnstile-Captcha, Idle-Logout 30 min.

Additiv:
- Edge Function `security-notify` (intern), die bei kritischen `audit_logs` Events Mail-Versand triggern kann (`send-transactional-email` falls vorhanden, sonst no-op log)
- Frontend-Settings-Panel im Security Center (rein Anzeige + write nach `app_settings` Key `security.login_protection` — `app_settings` existiert bereits): max. Fehlversuche, Sperrdauer, Notify-Empfänger

## 5. Keine DB-Schema-Änderungen

Alles nutzt bestehende Tabellen (`login_sessions`, `audit_logs`, `app_settings`, `user_profiles`, `user_roles`). **Keine Migration.**

## 6. Dateien

Neu:
- `src/pages/SecurityCenter.tsx`
- `src/pages/CovertLogin.tsx` (dünner Wrapper um `Login` mit Helmet noindex)
- `src/components/security/SecurityScoreCard.tsx`
- `src/components/security/SessionsTable.tsx`
- `src/components/security/AuditEventsTable.tsx`
- `supabase/functions/security-notify/index.ts`

Geändert (rein additiv):
- `src/App.tsx` — 4 neue Routen
- `src/pages/Operation.tsx` — eine zusätzliche Tile (nur für Admin-Rollen)
- `public/robots.txt` — Disallow-Zeilen
- `index.html` — keine Änderung (per-Route Helmet)

## Out of scope

Geo-Lookup für „Standort" wird best-effort als „—" angezeigt, sofern keine GeoIP-Quelle konfiguriert ist (kein neuer Drittanbieter ohne Rückfrage).
