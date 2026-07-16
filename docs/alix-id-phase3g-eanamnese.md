# Sub-Phase 3g · App #6 — eAnamnese

Aktivierung von eAnamnese als sechste angebundene Alix-App über Alix ID.
Grundlage: `docs/alix-id-phase3g.md` (Aktivierungs-Checkliste).

> ⚠️ **MFA-Pflicht + verkürzte Session (20 min).** eAnamnese verarbeitet
> ausschließlich Gesundheitsdaten (Art. 9 DSGVO). Produktive Aktivierung
> frühestens nach Phase 3f (MFA-Enforcement).

## Konfiguration in `alix_applications`

| Feld | Wert |
| --- | --- |
| `app_key` | `eanamnese` |
| `app_name` | `eAnamnese` |
| `app_status` | `inactive` → `active` erst nach Phase 3f + Integrationstest |
| `base_url` | `https://eanamnese.alixwork.de` |
| `redirect_uris` | `https://eanamnese.alixwork.de/sso/callback`, `https://www.eanamnese.alixwork.de/sso/callback` |
| `allowed_origins` | `https://eanamnese.alixwork.de`, `https://www.eanamnese.alixwork.de` |
| `requires_mfa` | `true` |
| `session_duration_minutes` | `20` |

## Besonderheit — Gesundheitsdaten

eAnamnese speichert Fragebögen und medizinische Vorgeschichte. Zusätzlich
zu MFA und 20-min-Session gilt:

- Alix ID liefert nur Identität + `app_role`. Patient-zu-Praxis-
  Zuordnungen bleiben in eAnamnese-eigenen Tabellen und deren RLS.
- `access_token` **niemals** im LocalStorage; ausschließlich HttpOnly-
  Cookie (`SameSite=Strict`, `Secure`).
- Client-seitiger Idle-Timeout: **10 min** (unter `session_duration`),
  bei Inaktivität automatischer Logout mit Zwischenspeicher-Warnung.
- Re-Auth (MFA-Step-up) für PDF-Export und Fragebogen-Löschung.
- Keine URL-Parameter mit Patient-IDs; ausschließlich POST + Body.

Empfohlenes `app_role`-Mapping:

| `app_role` | Bedeutung |
| --- | --- |
| `admin` | Praxis-Admin, Fragebögen konfigurieren |
| `arzt` | eigene Patienten, Freigabe, Export |
| `assistenz` | Fragebogen-Versand, keine medizinische Auswertung |
| `patient` | eigenes Formular ausfüllen (falls Patient-Login genutzt) |

## Integration in der eAnamnese-Codebasis

1. `src/lib/alix-id/sso-client.ts` und `SsoCallbackExample.tsx` übernehmen.
2. `SsoCallbackExample.tsx` → `SsoCallback.tsx`, `APP_KEY = 'eanamnese'`.
3. Route: `<Route path="/sso/callback" element={<SsoCallback />} />`.
4. Login-Button:

   ```ts
   const client = createAlixIdClient({
     issuer: 'https://id.alixwork.de',
     appKey: 'eanamnese',
     redirectUri: `${window.location.origin}/sso/callback`,
   });
   await client.startLogin({ state: { returnTo: '/heute' } });
   ```

5. Callback: bei `alix_id_error:mfa_required` → `/id/sicherheit`
   (Enrollment), danach erneuter `startLogin()`.
6. Idle-Timer in der App implementieren (10 min ohne Nutzeraktion →
   `signOut()`), unabhängig vom Server-Session-Ablauf.

## Test-Zugriffe seeden

Mindestens ein interner Testnutzer je Rolle (`admin`, `arzt`, `assistenz`)
mit **aktiviertem MFA** unter `/id-admin/access`.

## Integrationstest

| Fall | Erwartung |
| --- | --- |
| Nutzer OHNE Zugriff → `alix-id-authorize` | 403, Event `sso_authorize_denied` |
| Nutzer MIT Zugriff, **ohne** MFA | 403 `mfa_required` (Phase 3f) |
| Nutzer MIT Zugriff **und** MFA, gültige PKCE | 302 → `/sso/callback?code=…` |
| Callback tauscht Code + Verifier innerhalb 60 s | 200 + Session |
| Session nach 20 min | abgelaufen |
| Idle 10 min in der App | Client-seitiger Auto-Logout |
| Zweite Verwendung desselben Codes | 400 `code_already_used` |
| Manipulierte `redirect_uri` | 400 `redirect_uri_mismatch` |
| App vorübergehend `inactive` | 403 `application_disabled` |
| Fragebogen-RLS (fremden Patienten lesen) | 403 durch App-eigene RLS |
| PDF-Export ohne Re-Auth | 403 `reauth_required` |

Erst nach vollständig grüner Testreihe **und** produktivem Phase 3f:
`app_status` auf `active` schalten.

## Rollback

`/id-admin/emergency-lock` → `eanamnese` auf `disabled`. Offene
Auth-Transaktionen verfallen nach 60 s. Betroffene Zugriffe können in
`/id-admin/access` gezielt widerrufen werden.

## Nächste App

App #7 (letzte) — **Alix Finance** (`alix_finance`). **MFA-Pflicht**,
`session_duration_minutes=30`, Feinberechtigung pro Modul
(Kassenbuch, SEPA, Bankimport, DATEV) bleibt in der Finance-App.
