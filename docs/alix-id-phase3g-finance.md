# Sub-Phase 3g · App #7 — Alix Finance

Aktivierung von Alix Finance als siebte und letzte angebundene Alix-App
über Alix ID. Grundlage: `docs/alix-id-phase3g.md`.

> ⚠️ **MFA-Pflicht + 30-min-Session + Feinberechtigung pro Modul.**
> Alix Finance verwaltet Kassenbuch, Bankimport, SEPA, DATEV,
> Mahnwesen und Konzern-Konsolidierung. Produktive Aktivierung
> frühestens nach Phase 3f (MFA-Enforcement).

## Konfiguration in `alix_applications`

| Feld | Wert |
| --- | --- |
| `app_key` | `alix_finance` |
| `app_name` | `Alix Finance` |
| `app_status` | `inactive` → `active` erst nach Phase 3f + Integrationstest |
| `base_url` | `https://alix-finance.de` |
| `redirect_uris` | `https://alix-finance.de/sso/callback`, `https://www.alix-finance.de/sso/callback` |
| `allowed_origins` | `https://alix-finance.de`, `https://www.alix-finance.de` |
| `requires_mfa` | `true` |
| `session_duration_minutes` | `30` |

## Besonderheit — Feinberechtigung pro Modul

Alix Finance hat modulare Rechte (Kassenbuch, SEPA-Freigabe, DATEV-
Export, Bankimport, Konsolidierung). Diese werden **nicht** in
Alix-ID-Tabellen gespeichert. Alix ID liefert nur:

- Identität + Organisation (Mandant)
- grobe `app_role` (z. B. `admin`, `buchhalter`, `viewer`)

Die Modulrechte bleiben in Finance-eigenen Tabellen
(`finance_stakeholders`, `finance_approvals`, `security_user_roles`,
`useFinancePermissions`) und deren RLS. Alle Vier-Augen-/Approval-
Workflows (SEPA, Zahlungen, Jahresabschluss) laufen **innerhalb** von
Alix Finance und dürfen nicht durch Alix ID abgekürzt werden.

Empfohlenes `app_role`-Mapping:

| `app_role` | Bedeutung (grob) |
| --- | --- |
| `admin` | Voll-Admin des Mandanten |
| `buchhalter` | Buchungen, Belege, Mahnwesen |
| `sepa_freigabe` | darf SEPA-Runs freigeben (zweites Augenpaar) |
| `datev_export` | darf DATEV-Exporte auslösen |
| `viewer` | Nur Lesezugriff (Reports/Cockpit) |

## Integration in der Finance-Codebasis

Alix Finance läuft **in diesem Repo** unter `/finance/*`. Für den
SSO-Rollout muss zusätzlich zur bestehenden AlixWork-Anbindung
(`alixwork_customer`) eine separate Auth-Transaktion für `alix_finance`
möglich sein, falls Finance perspektivisch als eigene Domain
`alix-finance.de` deployed wird.

Kurzfristig (Finance = Sub-Route von AlixWork):

- **Keine Änderung** an der Login-UI nötig; die bestehende
  AlixWork-Session deckt Finance ab.
- MFA-Step-up für sensitive Finance-Aktionen (SEPA-Freigabe,
  DATEV-Export, Jahresabschluss) läuft über bereits vorhandene
  `mfa-reauth`-Edge-Function.

Mittelfristig (Finance als eigene Domain `alix-finance.de`):

1. `src/lib/alix-id/sso-client.ts` und `SsoCallbackExample.tsx`
   in die separate Finance-Codebasis übernehmen.
2. `APP_KEY = 'alix_finance'`.
3. Route: `<Route path="/sso/callback" element={<SsoCallback />} />`.
4. Login-Button:

   ```ts
   const client = createAlixIdClient({
     issuer: 'https://id.alixwork.de',
     appKey: 'alix_finance',
     redirectUri: `${window.location.origin}/sso/callback`,
   });
   await client.startLogin({ state: { returnTo: '/cockpit' } });
   ```

5. `access_token` **niemals** im LocalStorage — HttpOnly-Cookie
   (`SameSite=Strict`, `Secure`).
6. Client-Idle-Timer: **10 min** ohne Nutzeraktion → Auto-Logout.

## Test-Zugriffe seeden

Mindestens ein interner Testnutzer je Rolle (`admin`, `buchhalter`,
`sepa_freigabe`, `datev_export`, `viewer`) mit **aktiviertem MFA**
unter `/id-admin/access` — für jeden Mandanten separat.

## Integrationstest

| Fall | Erwartung |
| --- | --- |
| Nutzer OHNE Zugriff → `alix-id-authorize` | 403, Event `sso_authorize_denied` |
| Nutzer MIT Zugriff, **ohne** MFA | 403 `mfa_required` (Phase 3f) |
| Nutzer MIT Zugriff **und** MFA, gültige PKCE | 302 → `/sso/callback?code=…` |
| Callback tauscht Code + Verifier innerhalb 60 s | 200 + Session |
| Session nach 30 min | abgelaufen |
| Idle 10 min in der App | Client-seitiger Auto-Logout |
| Zweite Verwendung desselben Codes | 400 `code_already_used` |
| Manipulierte `redirect_uri` | 400 `redirect_uri_mismatch` |
| App vorübergehend `inactive` | 403 `application_disabled` |
| SEPA-Freigabe ohne Rolle `sepa_freigabe` | 403 durch Finance-RLS |
| DATEV-Export ohne Re-Auth | 403 `reauth_required` |
| Mandant-Isolation (Fremd-Mandant lesen) | 403 durch Finance-RLS |

Erst nach vollständig grüner Testreihe **und** produktivem Phase 3f:
`app_status` auf `active` schalten.

## Rollback

`/id-admin/emergency-lock` → `alix_finance` auf `disabled`. Offene
Auth-Transaktionen verfallen nach 60 s. Betroffene Zugriffe können in
`/id-admin/access` gezielt widerrufen werden.

## Abschluss Sub-Phase 3g

Mit Alix Finance ist die Konfiguration aller sieben Ziel-Apps im
Alix-ID-Katalog vollständig:

| # | App | `requires_mfa` | Session |
| - | --- | --- | --- |
| 1 | AlixSmart | false | 60 |
| 2 | Alix Academy | false | 60 |
| 3 | Medi Metropole | false | 60 |
| 4 | Mein Mediapaket | false | 60 |
| 5 | Alix Studio | **true** | 30 |
| 6 | eAnamnese | **true** | 20 |
| 7 | Alix Finance | **true** | 30 |

Produktive Aktivierung (`app_status='active'`) erfolgt strikt einzeln
und **nach** Phase 3f für alle MFA-pflichtigen Apps.
