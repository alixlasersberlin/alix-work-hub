# Sub-Phase 3g · App #5 — Alix Studio

Aktivierung von Alix Studio als fünfte angebundene Alix-App über Alix ID.
Grundlage: `docs/alix-id-phase3g.md` (Aktivierungs-Checkliste).

> ⚠️ **MFA-Pflicht.** Alix Studio verarbeitet Patientendaten. Die App
> darf frühestens produktiv aktiviert werden, wenn Phase 3f
> (MFA-Enforcement in `alix-id-authorize`) live ist.

## Konfiguration in `alix_applications`

| Feld | Wert |
| --- | --- |
| `app_key` | `alix_studio` |
| `app_name` | `Alix Studio` |
| `app_status` | `inactive` → `active` erst nach Phase 3f + Integrationstest |
| `base_url` | `https://studio.alixwork.de` |
| `redirect_uris` | `https://studio.alixwork.de/sso/callback`, `https://www.studio.alixwork.de/sso/callback` |
| `allowed_origins` | `https://studio.alixwork.de`, `https://www.studio.alixwork.de` |
| `requires_mfa` | `true` |
| `session_duration_minutes` | `30` |

## Besonderheit — Patientendaten

Alix Studio verarbeitet besondere Kategorien personenbezogener Daten
(Art. 9 DSGVO). Zusätzlich zu MFA gilt:

- Alix ID liefert **nur** Identität + grobe Rolle (`app_role`).
- Feingranulare Behandlungs-/Fallzugriffe bleiben in Studio-eigenen
  Tabellen und deren RLS.
- `access_token` **niemals** im LocalStorage; ausschließlich HttpOnly-
  Cookie mit `SameSite=Strict` und `Secure`.
- Session-Idle-Timeout in der App: 15 min (unter `session_duration`).
- Re-Auth (MFA-Step-up) für sensitive Aktionen (Fall löschen, Export)
  über bereits vorhandenes `mfa-reauth`-Muster (Phase 3f).

Empfohlenes `app_role`-Mapping:

| `app_role` | Bedeutung |
| --- | --- |
| `admin` | Vollzugriff |
| `therapeut` | eigene Fälle + zugewiesene Fälle |
| `assistenz` | Terminvergabe, keine medizinischen Notizen |

## Integration in der Studio-Codebasis

1. `src/lib/alix-id/sso-client.ts` und `SsoCallbackExample.tsx` übernehmen.
2. `SsoCallbackExample.tsx` → `SsoCallback.tsx`, `APP_KEY = 'alix_studio'`.
3. Route: `<Route path="/sso/callback" element={<SsoCallback />} />`.
4. Login-Button:

   ```ts
   const client = createAlixIdClient({
     issuer: 'https://id.alixwork.de',
     appKey: 'alix_studio',
     redirectUri: `${window.location.origin}/sso/callback`,
   });
   await client.startLogin({ state: { returnTo: '/heute' } });
   ```

5. Callback: bei `alix_id_error:mfa_required` den Nutzer zur
   MFA-Enrollment-Seite `/id/sicherheit` weiterleiten, danach erneuten
   `startLogin()` auslösen.

## Test-Zugriffe seeden

Mindestens ein interner Testnutzer je Rolle (`admin`, `therapeut`,
`assistenz`) mit **aktiviertem MFA** unter `/id-admin/access`.

## Integrationstest

| Fall | Erwartung |
| --- | --- |
| Nutzer OHNE Zugriff → `alix-id-authorize` | 403, Event `sso_authorize_denied` |
| Nutzer MIT Zugriff, **ohne** MFA | 403 `mfa_required` (Phase 3f) |
| Nutzer MIT Zugriff **und** MFA, gültige PKCE | 302 → `/sso/callback?code=…` |
| Callback tauscht Code + Verifier innerhalb 60 s | 200 + Session |
| Session nach 30 min | abgelaufen, erneuter Login nötig |
| Zweite Verwendung desselben Codes | 400 `code_already_used` |
| Manipulierte `redirect_uri` | 400 `redirect_uri_mismatch` |
| App vorübergehend `inactive` | 403 `application_disabled` |
| Fall-RLS in Studio (fremden Patienten lesen) | 403 durch App-eigene RLS |

Erst nach vollständig grüner Testreihe **und** produktivem Phase 3f:
`app_status` auf `active` schalten.

## Rollback

`/id-admin/emergency-lock` → `alix_studio` auf `disabled`. Offene
Auth-Transaktionen verfallen nach 60 s. Betroffene Zugriffe können in
`/id-admin/access` gezielt widerrufen werden.

## Nächste App

App #6 — **eAnamnese** (`eanamnese`). **MFA-Pflicht**, noch kürzere
Sitzung (`session_duration_minutes=20`). Ebenfalls Phase 3f Voraussetzung.
