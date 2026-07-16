# Sub-Phase 3g · App #1 — AlixSmart

Aktivierung von AlixSmart als erste angebundene Alix-App über Alix ID.
Grundlage: `docs/alix-id-phase3g.md` (Aktivierungs-Checkliste).

## Konfiguration in `alix_applications`

Bereits gesetzt (verifiziert per `SELECT`):

| Feld | Wert |
| --- | --- |
| `app_key` | `alixsmart` |
| `app_name` | `AlixSmart` |
| `app_status` | `active` |
| `base_url` | `https://alixsmart.de` |
| `redirect_uris` | `https://alixsmart.de/sso/callback`, `https://www.alixsmart.de/sso/callback` |
| `allowed_origins` | `https://alixsmart.de`, `https://www.alixsmart.de` |
| `requires_mfa` | `false` (gemäß 3g-Rollout-Tabelle) |
| `session_duration_minutes` | `60` |

Änderungen erfolgen künftig ausschließlich über `/id-admin/applications`.

## Integration in der AlixSmart-Codebasis

1. `src/lib/alix-id/sso-client.ts` **und** `src/lib/alix-id/SsoCallbackExample.tsx`
   1:1 aus diesem Repo in die AlixSmart-Codebasis kopieren.
2. `SsoCallbackExample.tsx` in `SsoCallback.tsx` umbenennen, `APP_KEY`
   und `ALIX_ID_ISSUER` bei Bedarf per Env überschreiben.
3. Route registrieren: `<Route path="/sso/callback" element={<SsoCallback />} />`.
4. Login-Button (z. B. „Mit Alix ID anmelden"):

   ```ts
   const client = createAlixIdClient({
     issuer: 'https://id.alixwork.de',
     appKey: 'alixsmart',
     redirectUri: `${window.location.origin}/sso/callback`,
   });
   await client.startLogin({ state: { returnTo: '/dashboard' } });
   ```

5. Nach `completeLogin()` das `access_token` **nicht** im LocalStorage
   speichern — an einen eigenen Backend-Endpoint posten und als
   HttpOnly-Cookie setzen.

## Test-Zugriffe seeden

Mindestens ein interner Testnutzer erhält unter `/id-admin/access` einen
aktiven Zugriff für `alixsmart` mit Rolle `technician`. Kein produktiver
Nutzer bekommt Vorab-Zugriff.

## Integrationstest (manuell durchgeführt)

| Fall | Ergebnis |
| --- | --- |
| Nutzer OHNE Zugriff → `alix-id-authorize` | 403, Event `sso_authorize_denied` |
| Nutzer MIT Zugriff, gültige PKCE | 302 → `/sso/callback?code=…` |
| Callback tauscht Code + Verifier innerhalb 60 s | 200 + Session |
| Zweite Verwendung desselben Codes | 400 `code_already_used` |
| Manipulierte `redirect_uri` | 400 `redirect_uri_mismatch` |
| App vorübergehend `inactive` | 403 `application_disabled` |

## Rollback

Sicherheits-Notfall: `/id-admin/emergency-lock` → `alixsmart` auf
`disabled`. Offene Auth-Transaktionen verfallen nach 60 s.

## Nächste App

App #2 — **Alix Academy** (`alix_academy`). Erst konfigurieren, dann
seeden, dann aktivieren — nie parallel zu einem laufenden Rollout.
