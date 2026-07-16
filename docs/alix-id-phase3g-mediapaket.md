# Sub-Phase 3g · App #4 — Mein Mediapaket

Aktivierung von Mein Mediapaket als vierte angebundene Alix-App über Alix ID.
Grundlage: `docs/alix-id-phase3g.md` (Aktivierungs-Checkliste).

## Konfiguration in `alix_applications`

| Feld | Wert |
| --- | --- |
| `app_key` | `alix_mediapaket` |
| `app_name` | `Mein Mediapaket` |
| `app_status` | `inactive` → `active` nach bestandenem Integrationstest |
| `base_url` | `https://mediapaket.alixwork.de` |
| `redirect_uris` | `https://mediapaket.alixwork.de/sso/callback`, `https://www.mediapaket.alixwork.de/sso/callback` |
| `allowed_origins` | `https://mediapaket.alixwork.de`, `https://www.mediapaket.alixwork.de` |
| `requires_mfa` | `false` |
| `session_duration_minutes` | `60` |

## Besonderheit — große Uploads

Mein Mediapaket lädt Marketing-Assets (Bilder, Videos, PDFs) mit hoher
Dateigröße hoch. Alix ID liefert nur Identität und Rolle; Upload-Limits
und Storage-Buckets (`media_package_files` etc.) bleiben in der App
konfiguriert. Empfohlen:

- Uploads gehen **direkt** an einen App-eigenen Endpoint (oder Supabase
  Storage der App), authentifiziert mit dem HttpOnly-Cookie der App.
- Alix-ID-`access_token` wird **nicht** für Upload-Requests verwendet.
- Große Uploads: Client-seitig Chunking (5-10 MB) und Progress-UI.

Empfohlenes `app_role`-Mapping:

| `app_role` | Bedeutung |
| --- | --- |
| `admin` | Vollzugriff, Freigaben, Branding |
| `editor` | Uploads und Bearbeitung |
| `viewer` | Nur Ansicht / Download |

## Integration in der Mediapaket-Codebasis

1. `src/lib/alix-id/sso-client.ts` und `SsoCallbackExample.tsx` übernehmen.
2. `SsoCallbackExample.tsx` → `SsoCallback.tsx`, `APP_KEY = 'alix_mediapaket'`.
3. Route: `<Route path="/sso/callback" element={<SsoCallback />} />`.
4. Login-Button:

   ```ts
   const client = createAlixIdClient({
     issuer: 'https://id.alixwork.de',
     appKey: 'alix_mediapaket',
     redirectUri: `${window.location.origin}/sso/callback`,
   });
   await client.startLogin({ state: { returnTo: '/dashboard' } });
   ```

5. `access_token` **nicht** im LocalStorage speichern — an eigenes Backend
   posten und als HttpOnly-Cookie halten.

## Test-Zugriffe seeden

Mindestens ein interner Testnutzer je Rolle (`admin`, `editor`, `viewer`)
unter `/id-admin/access`.

## Integrationstest

| Fall | Erwartung |
| --- | --- |
| Nutzer OHNE Zugriff → `alix-id-authorize` | 403, Event `sso_authorize_denied` |
| Nutzer MIT Zugriff, gültige PKCE | 302 → `/sso/callback?code=…` |
| Callback tauscht Code + Verifier innerhalb 60 s | 200 + Session |
| Zweite Verwendung desselben Codes | 400 `code_already_used` |
| Manipulierte `redirect_uri` | 400 `redirect_uri_mismatch` |
| App vorübergehend `inactive` | 403 `application_disabled` |
| Großer Upload (>100 MB) nach Login | erfolgreich, Alix-ID-Token nicht benötigt |

Erst nach vollständig grüner Testreihe: `app_status` auf `active`.

## Rollback

`/id-admin/emergency-lock` → `alix_mediapaket` auf `disabled`. Offene
Auth-Transaktionen verfallen nach 60 s.

## Nächste App

App #5 — **Alix Studio** (`alix_studio`). **MFA-Pflicht** (Patientendaten),
`requires_mfa=true`, `session_duration_minutes=30`. Frühestens aktivieren,
wenn Phase 3f (MFA-Enforcement) live ist.
