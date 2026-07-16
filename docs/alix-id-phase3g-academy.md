# Sub-Phase 3g · App #2 — Alix Academy

Aktivierung von Alix Academy als zweite angebundene Alix-App über Alix ID.
Grundlage: `docs/alix-id-phase3g.md` (Aktivierungs-Checkliste).

## Konfiguration in `alix_applications`

| Feld | Wert |
| --- | --- |
| `app_key` | `alix_academy` |
| `app_name` | `Alix Academy` |
| `app_status` | `inactive` → `active` nach bestandenem Integrationstest |
| `base_url` | `https://academy.alixwork.de` |
| `redirect_uris` | `https://academy.alixwork.de/sso/callback`, `https://www.academy.alixwork.de/sso/callback` |
| `allowed_origins` | `https://academy.alixwork.de`, `https://www.academy.alixwork.de` |
| `requires_mfa` | `false` (kein Finance-Bezug) |
| `session_duration_minutes` | `60` |

Alle weiteren Änderungen erfolgen ausschließlich über `/id-admin/applications`.

## Integration in der Academy-Codebasis

1. `src/lib/alix-id/sso-client.ts` und `SsoCallbackExample.tsx` aus diesem
   Repo in die Academy-Codebasis kopieren.
2. `SsoCallbackExample.tsx` → `SsoCallback.tsx` umbenennen, `APP_KEY`
   auf `'alix_academy'` setzen.
3. Route: `<Route path="/sso/callback" element={<SsoCallback />} />`.
4. Login-Button:

   ```ts
   const client = createAlixIdClient({
     issuer: 'https://id.alixwork.de',
     appKey: 'alix_academy',
     redirectUri: `${window.location.origin}/sso/callback`,
   });
   await client.startLogin({ state: { returnTo: '/kurse' } });
   ```

5. `access_token` **nicht** im LocalStorage speichern — an eigenes Backend
   posten und als HttpOnly-Cookie halten. Fach-Rollen (Trainer, Student,
   Zertifikatsprüfer) werden **in der Academy** über eigene Tabellen
   verwaltet; Alix ID liefert nur Identität + `app_role`.

## Test-Zugriffe seeden

Mindestens ein interner Testnutzer erhält unter `/id-admin/access` einen
aktiven Zugriff für `alix_academy` mit Rolle `student` und ein weiterer
mit Rolle `trainer`. Keine produktiven Teilnehmer vorab.

## Integrationstest

| Fall | Erwartung |
| --- | --- |
| Nutzer OHNE Zugriff → `alix-id-authorize` | 403, Event `sso_authorize_denied` |
| Nutzer MIT Zugriff, gültige PKCE | 302 → `/sso/callback?code=…` |
| Callback tauscht Code + Verifier innerhalb 60 s | 200 + Session |
| Zweite Verwendung desselben Codes | 400 `code_already_used` |
| Manipulierte `redirect_uri` | 400 `redirect_uri_mismatch` |
| App vorübergehend `inactive` | 403 `application_disabled` |

Erst nach vollständig grüner Testreihe: `app_status` in
`/id-admin/applications` auf `active` schalten.

## Rollback

Sicherheits-Notfall: `/id-admin/emergency-lock` → `alix_academy` auf
`disabled`. Offene Auth-Transaktionen verfallen nach 60 s.

## Nächste App

App #3 — **Medi Metropole** (`medi_metropole`). Eigene Prüfungs-Rollen,
kein Finance-Bezug, `requires_mfa=false`, `session_duration_minutes=60`.
