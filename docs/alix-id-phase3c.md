# Alix ID — Sub-Phase 3c (UI unter /id/*)

Nutzeroberfläche der zentralen Identität. Läuft unter derselben Origin wie
AlixWork (Pilot); eine dedizierte Domain `id.alixwork.de` kann später
konfiguriert werden, ohne Code-Änderungen an den Seiten.

## Routen

| Pfad | Seite | Zweck |
| --- | --- | --- |
| `/id/login` | `AlixId/Login.tsx` | OTP-Anmeldung (E-Mail-Code, `shouldCreateUser=false`) |
| `/id` | `AlixId/Layout.tsx` | Session-Guard + Navigation + globaler Logout |
| `/id/apps` | `AlixId/Apps.tsx` | App-Picker: freigeschaltete + gesperrte Alix-Anwendungen |
| `/id/konto` | `AlixId/Konto.tsx` | Identität + zugeordnete Organisationen |
| `/id/sicherheit` | `AlixId/Sicherheit.tsx` | Login-Methoden, MFA-Vorschau, Datenschutz-Hinweis |
| `/id/sitzungen` | `AlixId/Sitzungen.tsx` | Security-Event-Log der Identität + "Von allen Geräten abmelden" |

`/id` redirected auf `/id/apps`. Nicht-eingeloggte Besucher werden vom
Layout auf `/id/login` weitergeleitet.

## Datenfluss

- **Login:** `supabase.auth.signInWithOtp` + `verifyOtp`. Beim ersten
  Aufruf einer geschützten `/id`-Seite bootstrapped `alix-id-userinfo`
  server­seitig die `alix_identities`-Zeile (Auth-User × Identity).
- **Apps:** ruft `alix-id-userinfo` → zeigt Katalog + `has_access` pro App.
  Klick auf "Öffnen":
  1. Client generiert PKCE-Verifier (32 Byte) + Challenge (S256) + State.
  2. Verifier + Redirect-URI werden in `sessionStorage` unter
     `alix_id_pkce_<state>` abgelegt (nur für 3d/Callback-Handling).
  3. `alix-id-authorize` liefert Redirect-URL, Browser navigiert dorthin.
- **Konto:** liest identische `alix-id-userinfo`-Antwort, zeigt Organisationen
  read-only. Änderungen laufen zwingend über Alix Lasers.
- **Sicherheit:** informativ + „Test-Code anfordern"-Button.
- **Sitzungen:** liest `alix_security_events` direkt via RLS (nur eigene
  Identity). Button ruft `alix-id-logout` mit `scope=global` und meldet
  Supabase-Session ab.

## Sicherheit im Frontend

- Kein Access-Token in URL, `sessionStorage`, oder DOM. Nur der PKCE-Verifier
  liegt in `sessionStorage` (unschädlich ohne den Code).
- Layout prüft `account_status !== 'active'` → sofortiges Logout.
- Alle mutierenden Aktionen laufen ausschließlich über Edge Functions (Server
  entscheidet, RLS greift zusätzlich).
- Nutzt bestehende Portal-Auth-Härtungen (`Login.tsx` des Kundenportals bleibt
  unverändert; `/id/login` ist die *neue* Anmeldung für Alix ID, ohne
  Portal-Zugangsprüfung — die App-spezifische Freigabe passiert erst beim
  Klick auf eine App).

## Nicht in 3c enthalten

- Kein Callback-Handler in AlixWork (`/sso/callback` → `alix-id-token`) —
  das ist Sub-Phase 3d.
- Kein E-Mail-/Passwort-Reset, keine Profil-Bearbeitung durch den Kunden.
- Kein Admin-Panel; kommt in 3e.
- Kein Passkey/MFA-Enrollment (3f).

## Rollback 3c

- Routen `/id/*` in `src/App.tsx` löschen (Block "Alix ID — zentrale
  Identität" + sieben `lazy`-Imports).
- Ordner `src/pages/AlixId/` und `src/lib/alix-id/` löschen.
- Edge Functions (3b) und Datenbank (3a) bleiben intakt.

## Test-Checklist (manuell)

1. `/id/login` → E-Mail eingeben → Code → landet auf `/id/apps`.
2. AlixWork ist als aktive App sichtbar mit Badge der App-Rolle. Alle
   anderen Apps erscheinen "gesperrt" mit Schloss-Icon.
3. Klick "Öffnen" bei AlixWork → Browser navigiert zu
   `<base_url>/sso/callback?code=…&state=…`. (Bis 3d fertig ist, gibt es
   dort noch keinen Handler — erwartetes Verhalten.)
4. `/id/konto` zeigt Identität + Organisation (Firmenname aus
   `alix_organizations`).
5. `/id/sitzungen` listet `sso_authorize_issued` nach Öffnen einer App
   sowie den `logout`-Event nach Klick auf "Von allen Geräten abmelden".
6. Nach globalem Logout ist keine Anmeldung mehr aktiv; Reload landet auf
   `/id/login`.
