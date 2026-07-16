# Sub-Phase 3g · App #3 — Medi Metropole

Aktivierung von Medi Metropole als dritte angebundene Alix-App über Alix ID.
Grundlage: `docs/alix-id-phase3g.md` (Aktivierungs-Checkliste).

## Konfiguration in `alix_applications`

| Feld | Wert |
| --- | --- |
| `app_key` | `medi_metropole` |
| `app_name` | `Medi Metropole` |
| `app_status` | `inactive` → `active` nach bestandenem Integrationstest |
| `base_url` | `https://medi-metropole.de` |
| `redirect_uris` | `https://medi-metropole.de/sso/callback`, `https://www.medi-metropole.de/sso/callback` |
| `allowed_origins` | `https://medi-metropole.de`, `https://www.medi-metropole.de` |
| `requires_mfa` | `false` (Prüfungsdaten, aber kein Finance-/Patientendatenbezug) |
| `session_duration_minutes` | `60` |

Alle weiteren Änderungen erfolgen ausschließlich über `/id-admin/applications`.

## Besonderheit — eigene Prüfungs-Rollen

Medi Metropole hat eigene Fach-Rollen (Prüfer, Ausbilder, Kursleitung,
Teilnehmer). Diese werden **nicht** in Alix-ID-Tabellen gespeichert;
Alix ID liefert nur `app_role` (grobe Ebene). Die Feingranularität
(Prüfungsberechtigung pro Modul) bleibt in Medi-Metropole-eigenen Tabellen
und deren RLS.

Empfohlenes `app_role`-Mapping bei Zugriffsvergabe:

| `alix_identity_app_access.app_role` | Bedeutung in Medi Metropole |
| --- | --- |
| `admin` | Vollzugriff, Prüfungsplanung |
| `pruefer` | darf Prüfungen abnehmen und bewerten |
| `ausbilder` | darf Kurse und Materialien pflegen |
| `teilnehmer` | Standard-Kursteilnehmer |

## Integration in der Medi-Metropole-Codebasis

1. `src/lib/alix-id/sso-client.ts` und `SsoCallbackExample.tsx` aus diesem
   Repo übernehmen.
2. `SsoCallbackExample.tsx` → `SsoCallback.tsx`, `APP_KEY = 'medi_metropole'`.
3. Route: `<Route path="/sso/callback" element={<SsoCallback />} />`.
4. Login-Button:

   ```ts
   const client = createAlixIdClient({
     issuer: 'https://id.alixwork.de',
     appKey: 'medi_metropole',
     redirectUri: `${window.location.origin}/sso/callback`,
   });
   await client.startLogin({ state: { returnTo: '/pruefungen' } });
   ```

5. `access_token` **nicht** im LocalStorage speichern — an eigenes Backend
   posten und als HttpOnly-Cookie halten.

## Test-Zugriffe seeden

Mindestens ein interner Testnutzer je Rolle (`admin`, `pruefer`,
`teilnehmer`) unter `/id-admin/access`. Keine produktiven Prüfer vorab.

## Integrationstest

| Fall | Erwartung |
| --- | --- |
| Nutzer OHNE Zugriff → `alix-id-authorize` | 403, Event `sso_authorize_denied` |
| Nutzer MIT Zugriff, gültige PKCE | 302 → `/sso/callback?code=…` |
| Callback tauscht Code + Verifier innerhalb 60 s | 200 + Session |
| Zweite Verwendung desselben Codes | 400 `code_already_used` |
| Manipulierte `redirect_uri` | 400 `redirect_uri_mismatch` |
| App vorübergehend `inactive` | 403 `application_disabled` |
| Fach-RLS in Medi Metropole (fremde Prüfung lesen) | 403 durch App-eigene RLS |

Erst nach vollständig grüner Testreihe: `app_status` auf `active`.

## Rollback

`/id-admin/emergency-lock` → `medi_metropole` auf `disabled`. Offene
Auth-Transaktionen verfallen nach 60 s.

## Nächste App

App #4 — **Mein Mediapaket** (`alix_mediapaket`). Marketing-Upload,
große Dateien, `requires_mfa=false`, `session_duration_minutes=60`.
