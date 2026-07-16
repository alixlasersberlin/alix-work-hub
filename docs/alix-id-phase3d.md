# Alix ID — Sub-Phase 3d (AlixWork-Callback + SSO-Umstellung)

Der AlixWork-Portalbereich (`/kunde/*`) wird als erste Pilotanwendung an
Alix ID angebunden. Bestehende OTP-Anmeldung an `/kunde/login` bleibt
weiterhin funktionsfähig (Fallback).

## Änderungen im Frontend

| Datei | Zweck |
| --- | --- |
| `src/pages/AlixId/SsoCallback.tsx` | Neuer Callback (`/sso/callback`) — löst Code + PKCE-Verifier gegen `alix-id-token`, protokolliert Login und leitet auf `/kunde` |
| `src/pages/AlixId/Apps.tsx` | Fällt auf `window.location.origin` zurück, wenn keine `base_url` gepflegt ist (funktioniert in Preview + Custom Domain identisch) |
| `src/pages/CustomerPortal/Login.tsx` | Zweiter Button „Über Alix ID anmelden" → `/id/login`; klassischer OTP-Login bleibt darüber unverändert |
| `src/App.tsx` | Neue Routen `/sso/callback` sowie `AlixIdSsoCallback` lazy-import |

## Datenbank-Konfiguration

Migration `20260716_alix_id_alixwork_pilot`:

- setzt für `alix_applications.app_key = 'alixwork_customer'`:
  - `base_url = 'https://app.alixwork.de'`
  - `redirect_uris = { app.alixwork.de, alixwork.de, www.alixwork.de,
    alix-pro-hub.lovable.app, id-preview--…lovable.app }/sso/callback`
  - `allowed_origins` analog
  - `app_status = 'active'`

Damit ist der Callback in allen produktiven und Preview-Umgebungen
whitelisted; `alix-id-authorize` lehnt jede andere URL exakt ab.

## Kompletter SSO-Ablauf (Pilot)

```
Kunde
  │  1. Öffnet /id/login → OTP-Code → /id/apps
  │
  ├─► 2. Klick "AlixWork öffnen"
  │      Client:  PKCE-Verifier + Challenge + State erzeugen
  │               sessionStorage[alix_id_pkce_<state>] = { verifier, redirect_uri, app_key }
  │      Server:  alix-id-authorize
  │               - prüft App-Status, Access, Redirect-URI-Match
  │               - schreibt alix_auth_transactions (nur SHA-256-Hash)
  │               - liefert Redirect-URL zurück
  │
  ├─► 3. window.location = <origin>/sso/callback?code=…&state=…
  │
  ├─► 4. /sso/callback
  │      Client:  Verifier aus sessionStorage lesen, Session-Storage-Eintrag löschen
  │      Server:  alix-id-token
  │               - Race-safe used_at-Update
  │               - Ablauf/Redirect-URI/PKCE-Prüfung
  │               - liefert identity, application, access
  │      Client:  customer_portal_users last_login_at update
  │               logPortalAudit(login_success, via='alix_id_sso')
  │
  └─► 5. Navigation nach /kunde (bestehendes Kundenportal)
```

Same-origin-Pilot: Die Supabase-Auth-Session existiert bereits (aus Schritt
1), deshalb muss der Callback keine RP-eigene Session erzeugen. Für spätere
Apps mit eigener Backend-Session wird `alix-id-token` als Server-to-Server-
Aufruf verwendet (verify_jwt=false).

## Fallback

`/kunde/login` bleibt vollständig unverändert erreichbar:

- direktes OTP-Login ohne Alix ID → für Bestandskunden ohne Umschaltung
- keine Änderung an `customer_portal_users`-Logik oder RLS
- neue Schaltfläche „Über Alix ID anmelden" verlinkt lediglich auf `/id/login`

Wenn `alix-id-token` fehlschlägt, zeigt der Callback zwei Wege:

1. „Erneut mit Alix ID anmelden" → `/id/login`
2. „Klassische Anmeldung (Fallback)" → `/kunde/login`

## Sicherheit

- Redirect-URI-Whitelist ist DB-seitig; keine Wildcards. Ein Angriff mit
  fremder Origin scheitert an `alix-id-authorize` (403 `invalid_redirect_uri`).
- Authorization Code lebt max. 60 s und wird beim ersten Tausch verbraucht.
- PKCE (S256) verhindert Missbrauch abgefangener Codes.
- Verifier liegt nur in `sessionStorage` und wird beim Callback sofort
  entfernt.
- Alle Erfolgs- und Fehlpfade landen im `alix_security_events`-Log
  (`sso_authorize_issued/denied`, `sso_token_issued/denied`).
- Kein Access-Token oder Passwort verlässt jemals das Backend.

## Test-Checklist (manuell)

1. **Happy Path:** `/id/login` → Code → `/id/apps` → „AlixWork öffnen" →
   landet auf `/kunde`. Audit-Log zeigt `login_success` mit
   `via=alix_id_sso`. `alix_security_events` enthält `sso_authorize_issued`
   + `sso_token_issued`.
2. **Fallback OTP:** `/kunde/login` funktioniert weiterhin ohne Alix ID
   (kein Regressions-Bug).
3. **Ungültige Redirect-URI:** manuelles Setzen einer fremden Origin in
   `sessionStorage` bricht am Server ab (`redirect_uri_mismatch`).
4. **Doppelklick:** Zweiter Callback mit demselben Code endet in
   `invalid_or_expired_code`; Nutzer sieht Fehler + Retry-Link.
5. **Preview-Domain:** SSO funktioniert unter der Preview-URL, weil sie in
   `redirect_uris` whitelisted ist.

## Optionaler Backfill

`SELECT public.alix_id_bootstrap_from_portal_users();`

Übernimmt alle aktiven/eingeladenen `customer_portal_users` in
`alix_identities` + `alix_organizations` + `alix_identity_app_access`
für AlixWork. Idempotent. Sollte einmalig nach dem ersten erfolgreichen
Pilot-Test manuell im SQL-Editor ausgeführt werden.

## Rollback 3d

- `sessionStorage`- und Callback-Route entfernen: `/sso/callback` +
  `AlixIdSsoCallback` in `src/App.tsx` löschen, `SsoCallback.tsx` löschen.
- Alix-ID-Button in `CustomerPortal/Login.tsx` entfernen.
- Migration rückgängig:
  ```sql
  UPDATE public.alix_applications
  SET base_url = null, redirect_uris = '{}', allowed_origins = '{}'
  WHERE app_key = 'alixwork_customer';
  ```
- Kundenportal bleibt danach vollständig funktionsfähig (OTP-Login).

## Nächste Sub-Phase (3e)

Admin-Modul für Alix-ID unter `/id-admin/*` — Identitäten, Organisationen,
Applikationen, Zugriffe, Sessions, Security-Events, Emergency-Lock.
