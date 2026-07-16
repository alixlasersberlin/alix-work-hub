# Alix ID — Sub-Phase 3e: Administration UI

Interne Verwaltungsoberfläche für die zentrale Alix ID unter `/id-admin/*`.
Nur zugänglich für **Super Admin** und **Admin** (Frontend-Guard + serverseitige
`has_alix_id_permission()`-Prüfung in der Edge Function `alix-id-admin`).

## Routen

| Route | Zweck |
| --- | --- |
| `/id-admin` | Redirect auf `/id-admin/identities` |
| `/id-admin/identities` | Identitäten suchen, sperren/reaktivieren |
| `/id-admin/organizations` | Organisationen einsehen (Kunden-/Mandanten-Bindung) |
| `/id-admin/applications` | App-Katalog pflegen: Redirect-URIs, MFA, Status, Session-Länge |
| `/id-admin/access` | App-Zugriffe pro Identität × Organisation × App gewähren/entziehen |
| `/id-admin/sessions` | Letzte 200 Auth-Transaktionen (SSO-Codes) mit Status |
| `/id-admin/security-events` | Sicherheits-Log (Login, Grant, Suspend, App-Änderung …) |
| `/id-admin/emergency-lock` | Notfall: App sofort deaktivieren/reaktivieren |

## Sicherheitsdesign

- **Client-Guard** in `Layout.tsx` blockiert alle Nicht-Admins (Redirect auf `/access-denied`).
- Jede Mutation läuft über die Edge Function `alix-id-admin` — dort prüft
  `requireAdminPermission()` erneut serverseitig gegen `alix_id_admin_permissions`
  bzw. Super-Admin-Bypass.
- Alle Mutationen (`grant_access`, `revoke_access`, `suspend_identity`,
  `reactivate_identity`, `update_application`) schreiben unveränderliche
  Einträge in `alix_security_events` (inkl. `by`, IP, User-Agent).
- Reines Lesen erfolgt über die bestehenden RLS-Policies der `alix_*`-Tabellen.
- Kein Zugriff auf Klartext-Auth-Codes — die Sessions-Ansicht zeigt nur Metadaten
  aus `alix_auth_transactions` (`status`, `redirect_uri`, `expires_at`).

## Nicht enthalten in 3e (bewusst)

- MFA-Enforcement / Passkey-Verwaltung → **3f**
- Rollout weiterer Apps (AlixSmart, Academy, …) → **3g**
- Bulk-Imports / SCIM → separater Track
- Kein Zugriff auf Kundendaten aus AlixWork/Finance — diese bleiben in ihren
  Fachsystemen; die Admin-UI bindet nur die zentrale Identität.

## Rollback

Rein additiv (nur neue Frontend-Routen). Rollback = die sieben Dateien unter
`src/pages/IdAdmin/*` und die Routenregistrierung in `src/App.tsx` entfernen.
Datenbank und Edge Functions bleiben unverändert.

## Test-Checkliste

1. Login als Nicht-Admin → `/id-admin` → Weiterleitung auf `/access-denied`.
2. Super Admin → alle sieben Tabs erreichbar.
3. Identität sperren → `alix_identities.account_status='suspended'`, offene Auth-
   Transaktionen dieser Identität auf `revoked`, Event `identity_suspended`.
4. Zugriff gewähren (neue Kombination) → neue Zeile `access_status='active'`,
   Event `access_granted`.
5. Bestehenden Zugriff entziehen → `access_status='revoked'`, Event `access_revoked`.
6. Applikation editieren (Redirect-URIs) → Werte aktualisiert, Event `application_updated`.
7. Notfall-Deaktivierung → `app_status='disabled'`; neuer SSO-Versuch via
   `alix-id-authorize` schlägt fehl.
