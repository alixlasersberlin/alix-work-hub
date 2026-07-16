# Alix ID — Sub-Phase 3g: Rollout weiterer Apps

Sub-Phase 3g rüstet Alix ID vom „AlixWork-Pilot" (Phase 3d) zur **zentralen
SSO-Instanz** für alle Alix-Systeme aus. Jede weitere App wird einzeln
angebunden, aktiviert und getestet — kein Big-Bang.

## Rollout-Reihenfolge (verbindlich)

| # | App | app_key | Status Ziel | Besonderheiten |
| - | --- | --- | --- | --- |
| 1 | AlixSmart | `alixsmart` | `active` | Gerätezugriff, Techniker-Rollen |
| 2 | Alix Academy | `alix_academy` | `active` | Kurse, Zertifikate, kein Finance-Bezug |
| 3 | Medi Metropole | `medi_metropole` | `active` | eigene Prüfungs-Rollen |
| 4 | Mein Mediapaket | `alix_mediapaket` | `active` | Marketing-Upload, hohe Filegröße |
| 5 | Alix Studio | `alix_studio` | `active` | **MFA-Pflicht** (Patientendaten) |
| 6 | eAnamnese | `eanamnese` | `active` | **MFA-Pflicht**, kürzere Session (20 min) |
| 7 | Alix Finance | `alix_finance` | `active` | **MFA-Pflicht**, Feinberechtigung pro Modul |

Jede App durchläuft die identische Aktivierungs-Checkliste (unten).

## Wiederverwendbarer SSO-Client

`src/lib/alix-id/sso-client.ts` ist die Referenz-Implementierung für jede
angebundene App. Die Datei wird 1:1 in die jeweilige App kopiert (oder aus einem
gemeinsamen Paket importiert) und dort verwendet:

```ts
import { createAlixIdClient } from './alix-id/sso-client';

const alixId = createAlixIdClient({
  issuer: 'https://id.alixwork.de',
  appKey: 'alixsmart',
  redirectUri: 'https://smart.alix.de/sso/callback',
});

// Login-Button → startLogin() (PKCE, state, redirect)
// Callback-Route /sso/callback → const session = await alixId.completeLogin();
```

Enthalten:
- PKCE S256 (Verifier bleibt im sessionStorage).
- CSRF-geschützter `state` mit Nonce + Payload.
- Token-Tausch gegen `/functions/v1/alix-id-token`.
- Kein Access-Token in URLs.
- Identität, Organisationen und freigeschaltete Apps kommen in einem Aufruf.

## Aktivierungs-Checkliste (pro App)

Ohne Ausnahme in dieser Reihenfolge — **jeder Schritt dokumentiert bestätigen**:

1. **Applikation vollständig konfigurieren** unter `/id-admin/applications`:
   - `base_url` gesetzt (Produktions-Origin).
   - `redirect_uris` enthält *alle* Callback-URLs (Prod, Preview, Custom-Domain).
   - `allowed_origins` enthält die zugehörigen Origins.
   - `requires_mfa` gemäß Tabelle oben.
   - `session_duration_minutes` gemäß Tabelle oben.
2. **App-Zugriffe seeden** — mindestens ein interner Testnutzer pro Organisation
   erhält unter `/id-admin/access` einen aktiven Zugriff mit Testrolle.
3. **SSO-Client in der Ziel-App integrieren** (siehe oben) und `/sso/callback`
   implementieren.
4. **Integrationstest** durchführen (siehe Test-Plan unten).
5. **App auf `active` schalten** — erst jetzt via `/id-admin/applications`
   `app_status` von `inactive` → `active` setzen.
6. **Rollout kommunizieren** — Alix-ID-Benutzer sehen die App automatisch im
   `/id/apps`-Picker.

## Test-Plan pro App

| Fall | Erwartung |
| --- | --- |
| Nutzer OHNE Zugriff klickt App → `alix-id-authorize` | 403, Event `sso_authorize_denied` |
| Nutzer MIT Zugriff, korrekte redirect_uri, PKCE gültig | 302 → App-Callback mit `code` |
| Callback tauscht Code + Verifier innerhalb 60 s | 200 + Session, Event `sso_token_issued` |
| Zweite Verwendung desselben Codes | 400 `code_already_used` |
| Manipulierte redirect_uri | 400 `redirect_uri_mismatch` |
| App auf `inactive` gesetzt (Notfall) | 403 `application_disabled` |
| `requires_mfa=true`, Nutzer ohne MFA | 403 `mfa_required` (nach Phase 3f) |

## Sicherheits-Grenzen (bleiben strikt)

- Fachdaten (Rechnungen, Anamnesen, Gerätedaten, Kurse) **werden nicht** in
  Alix-ID-Tabellen gespeichert. Alix ID liefert nur Identität + Rollen; die
  RLS jeder Fach-App bleibt maßgeblich.
- `access_token` aus `alix-id-token` wird von der Ziel-App **nur intern**
  ausgewertet (HttpOnly-Cookie oder Server-Session). Kein LocalStorage.
- Der `alix_service`-Katalogeintrag bleibt vorerst `inactive`; er wird erst
  aktiviert, wenn die Rollen-Fein­granularität in 3f steht.

## Emergency-Playbook

- **Kompromittierte App** → `/id-admin/emergency-lock` → App auf `disabled`
  setzen. Alle offenen Auth-Transaktionen dieser App verfallen automatisch
  nach 60 s. Betroffene Zugriffe können per `/id-admin/access` gezielt
  widerrufen werden.
- **Kompromittierte Identität** → `/id-admin/identities` → `Sperren`. Alle
  offenen Codes dieser Identität werden per Edge Function serverseitig
  invalidiert.

## Änderungen in 3g

- **Neu:** `src/lib/alix-id/sso-client.ts` — Referenz-Client für Alix-Apps.
- **Neu:** `docs/alix-id-phase3g.md` (diese Datei) — Rollout- und Test-Plan.
- Roadmap in `docs/alix-id-phase3.md` aktualisiert.

Keine Datenbank-, RLS- oder Edge-Function-Änderungen in 3g. Der Rollout
selbst erfolgt kontrolliert über die vorhandene Admin-UI (Phase 3e).

## Rollback

Rein additiv. Rollback = neue Datei + Doku entfernen. Kein produktiver Effekt.
Bereits angebundene Apps können jederzeit einzeln durch `app_status='inactive'`
außer Betrieb genommen werden, ohne andere Apps zu beeinträchtigen.
