# Alix ID — Sub-Phase 3b (Edge Functions)

Sechs Deno-Edge-Functions bilden den kompletten SSO-Kern von Alix ID.
Alle nutzen `supabase/functions/_shared/alix-id.ts` für Auth-Prüfung,
PKCE-Verifikation, Random-Codes, SHA-256-Hashing und Security-Event-Logging.

## Endpunkte

| Function | JWT? | Rolle | Zweck |
| --- | --- | --- | --- |
| `alix-id-authorize` | ja | eingeloggte Identität | Authorization Code erzeugen (PKCE) |
| `alix-id-token` | **nein** | RP-Backend (Server-to-Server) | Code + Verifier gegen Identity/Access tauschen |
| `alix-id-userinfo` | ja | eingeloggte Identität | Identity, Orgs, App-Katalog mit `has_access` |
| `alix-id-logout` | ja | eingeloggte Identität | Logout-Event + optional alle Codes revoken |
| `alix-id-invite` | ja | `invite_identity`-Berechtigung | Neue Identität einladen, Org & App-Access setzen |
| `alix-id-admin` | ja | `manage_*`-Berechtigungen | Suspend/Reaktivieren/Access grant+revoke/App-Update |

`alix-id-token` läuft ohne JWT-Verifikation (in `supabase/config.toml` gesetzt),
weil es vom Backend der jeweiligen Ziel-App aufgerufen wird — die Authentizität
wird über den einmaligen Authorization Code + PKCE + Redirect-URI-Bindung
sichergestellt.

## Sicherheitsdesign

- **Authorization Code:** 32 Zufalls-Byte, nur SHA-256-Hash in
  `alix_auth_transactions.authorization_code_hash`. Klartext existiert nur
  in der Redirect-URL.
- **Race-safe Consumption:** `UPDATE ... WHERE used_at IS NULL AND expires_at > now() RETURNING *`
  — Doppel-Einlösung unmöglich.
- **PKCE:** `S256` oder `plain`, verpflichtend beim `/authorize`, verifiziert im
  `/token`. `code_verifier` 43-128 Zeichen.
- **Redirect-URI-Bindung:** exakter Match gegen `alix_applications.redirect_uris`,
  keine Wildcards. Beim Token-Tausch nochmal Vergleich.
- **App-Status Gate:** nur `app_status='active'` Apps akzeptieren Authorize.
- **Access Gate:** aktive Zeile in `alix_identity_app_access` mit
  `access_status='active'` und `valid_until` in Zukunft — sonst 403.
- **Identity Gate:** `account_status='active'` — sonst 403.
- **Security Events:** jede relevante Aktion (issued/denied/consumed/logout/
  grant/revoke/suspend/invite/app_update) landet in `alix_security_events`
  mit `ip_address`, `user_agent`, `severity`.
- **Logout global:** revoked alle offenen Codes der Identität.
- **Admin-Autorisierung:** `has_alix_id_permission(perm)` (Super Admin
  automatisch) über RPC — nicht clientseitig prüfbar.

## Aufrufmatrix

```
Frontend (Alix-ID-UI)        Backend (RP, z. B. AlixWork)
   │                                  │
   ├── invoke(alix-id-authorize) ─────┤
   │   { app_key, redirect_uri,       │
   │     code_challenge, state }      │
   │   ← { redirect, expires_in:60 }  │
   │                                  │
   ├─► GET redirect?code=…&state=… ──►│
   │                                  │
   │                                  ├── POST alix-id-token
   │                                  │   { code, code_verifier, redirect_uri }
   │                                  │   ← { identity, application, organization,
   │                                  │        access, scope }
   │                                  ├── setzt eigenes HttpOnly-Cookie
   │                                  │
```

## Test-Checklist (manuell)

1. **Happy Path AlixWork:** angemeldeter Kunde → `authorize` liefert Redirect →
   `token` gibt Identity + Access-Rolle zurück. `alix_security_events` zeigt
   `sso_authorize_issued` + `sso_token_issued`.
2. **Code-Wiederverwendung:** zweiter Aufruf `token` mit demselben Code →
   400 `invalid_or_expired_code`, `sso_token_denied` mit
   `reason=code_invalid_or_used`.
3. **Ablauf:** Code nach 60 s → 400 wie oben.
4. **Redirect-Mismatch:** manipuliertes `redirect_uri` beim Token-Tausch →
   400 `redirect_uri_mismatch`, Event severity `error`.
5. **PKCE-Fehler:** falscher `code_verifier` → 400 `pkce_verification_failed`.
6. **App inaktiv:** `app_status='draft'` → 403 `application_unavailable`.
7. **Kein Access:** Identity ohne aktiven `alix_identity_app_access` → 403
   `no_access`.
8. **Suspendierte Identity:** `account_status='suspended'` → 403 überall.
9. **Admin-Grant/Revoke:** `alix-id-admin` mit Nicht-Admin-User → 403.
10. **Logout global:** offene Codes werden auf `revoked` gesetzt; danach
    `token`-Tausch schlägt fehl.

## Rollback 3b

```bash
supabase functions delete alix-id-authorize
supabase functions delete alix-id-token
supabase functions delete alix-id-userinfo
supabase functions delete alix-id-logout
supabase functions delete alix-id-invite
supabase functions delete alix-id-admin
```

Und die drei zugehörigen Einträge in `supabase/config.toml` (nur
`alix-id-token` hat einen `verify_jwt=false`-Eintrag) sowie
`supabase/functions/_shared/alix-id.ts` entfernen. Da die UI noch nicht
umgestellt ist (3c/3d ausstehend), gibt es keine Nebenwirkungen auf den
laufenden Portal-Betrieb.

## Offen für 3c

- Frontend-Routen `/id/*` und Alix-ID-UI (Login, App-Picker, Konto,
  Sicherheit, Sitzungen).
- Zusätzliche `alix_id_admin_permissions`-Zeilen anlegen, sobald erste
  interne Admins definiert werden (Super Admin ist automatisch berechtigt).
- Optional: E-Mail-Templates für Invite (aktuell Standard-Supabase-Invite).
