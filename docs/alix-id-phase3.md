# Alix ID — Phase 3 Roadmap und Sub-Phase 3a (Fundament)

Zentrale digitale Identität und Single-Sign-on für alle Alix-Systeme.
Phase 1 (OTP-Login + Kundenportal) und Phase 2 (Angebote, Verträge, Signatur,
Nachrichten, Wartungen, DSGVO, Admin-Freigaben) bleiben **vollständig
unverändert**.

Diese Datei dokumentiert die Zielarchitektur, den Migrationsfahrplan und was
in Sub-Phase 3a bereits gebaut wurde.

## Zielarchitektur

```
                 ┌──────────────────┐
                 │     Alix ID      │  id.alixwork.de  (später)
                 │  Identität, OTP  │
                 │  MFA, Passkeys   │
                 │  App-Katalog     │
                 └────────┬─────────┘
                          │  Authorization Code (60s, PKCE, einmalig)
        ┌─────────┬───────┼───────┬─────────┬──────────┐
        ▼         ▼       ▼       ▼         ▼          ▼
   AlixWork  AlixSmart  Academy  Medi   Mediapaket  eAnamnese …
   (Pilot)                       Metrop.
        │         │       │       │         │          │
        └─────────┴───────┴───────┴─────────┴──────────┘
             Jede App prüft eigenständig:
             app_role · permissions · tenant · RLS
```

Zentral gespeichert: Identität, Anmeldung, App-Katalog, App-Zugriff, Session,
Sicherheitsereignisse.
**Nicht** zentral gespeichert: Rechnungen, Tickets, Gerätedaten, Anamnesen,
Finanzdaten, Schulungsinhalte, Mediapaket. Die bleiben in ihren Fachsystemen.

## Datenmodell (in 3a angelegt)

| Tabelle | Zweck |
| --- | --- |
| `alix_identities` | 1:1 zu `auth.users`, Kontostatus, Typ, Sprache, letzter Login |
| `alix_organizations` | Firmen/Studios/Schulen, optional an `customers.id` gebunden |
| `alix_identity_organizations` | m:n Beziehung (owner, employee, student, …) mit Gültigkeit |
| `alix_applications` | Katalog aller angeschlossenen Alix-Apps + Redirect-URIs |
| `alix_identity_app_access` | Pro Identität × Organisation × App: Rolle + Permissions + Ablauf |
| `alix_auth_transactions` | Kurzlebige Authorization-Codes (nur Hash, PKCE-fähig) |
| `alix_security_events` | Unveränderliches Audit für alle sicherheitsrelevanten Ereignisse |
| `alix_id_admin_permissions` | Interne Rechte für die Alix-ID-Verwaltung |

Helper-Funktionen:

- `public.current_alix_identity_id()` — Identität des angemeldeten Benutzers.
- `public.has_alix_id_permission(text)` — Rechteprüfung für interne
  Admins; Super Admin ist automatisch berechtigt.
- `public.alix_id_bootstrap_from_portal_users()` — idempotenter Backfill von
  `customer_portal_users` → `alix_identities` + `alix_organizations` +
  `alix_identity_app_access` für AlixWork; nur `service_role`.

Alle Tabellen haben RLS aktiviert. Benutzer sehen **ausschließlich** ihre
eigene Identität, ihre Organisationen (über die Verknüpfungstabelle) und
ihre eigenen App-Zugriffe. Der App-Katalog ist für alle angemeldeten
Benutzer lesbar (nur Metadaten wie Name/Icon).

## Non-destruktive Migration

- Keine Tabelle aus Phase 1/2 wurde angefasst.
- `customer_portal_users` bleibt Wahrheit für Phase-1-Login und Phase-2-RLS.
- Der Bootstrap kopiert nur, verändert nichts an Bestandsdaten.
- Rollback von 3a = alle acht neuen Tabellen droppen; kein Effekt auf
  Portal-Betrieb.

## Roadmap der Sub-Phasen

| Phase | Inhalt | Status |
| --- | --- | --- |
| **3a** | Datenmodell, RLS, Seed, Bootstrap-Funktion | ✅ fertig |
| **3b** | Edge Functions: `alix-id-authorize`, `alix-id-token`, `alix-id-userinfo`, `alix-id-logout`, `alix-id-invite`, `alix-id-admin` | ✅ fertig |
| **3c** | Alix-ID-UI: `/id/login` (OTP), `/id/apps` (Picker), `/id/konto`, `/id/sicherheit`, `/id/sitzungen` | ✅ fertig |
| **3d** | AlixWork-Portal auf SSO umstellen (Authorization-Code-Flow, Fallback auf OTP) | ⏳ |
| **3e** | Admin: `/id-admin/identities`, `/organizations`, `/applications`, `/access`, `/sessions`, `/security-events`, `/emergency-lock` | ⏳ |
| **3f** | MFA-Pflicht für sensible Rollen, Passkey-Vorbereitung, Risk-Scoring | ⏳ |
| **3g** | Weitere Apps: AlixSmart → Academy → Medi Metropole → Mediapaket → Studio → eAnamnese → Finance (jeweils einzeln getestet) | ⏳ |

Jede Sub-Phase endet mit dokumentiertem Test + Rollback.

## SSO-Flow (Design für 3b/3d)

```
1. Kunde ist bereits in Alix ID angemeldet (OTP-Session).
2. Klick auf App-Karte "AlixWork" → alix-id-authorize
     Input: app_key, organization_id, redirect_uri, code_challenge (PKCE), state
     Server:
       - prüft aktiven App-Zugriff (identity × org × app, access_status=active)
       - prüft redirect_uri exakt gegen alix_applications.redirect_uris
       - erzeugt 32-Byte-Code, speichert nur SHA-256-Hash in alix_auth_transactions
       - status='created', expires_at = now()+60s
       - Redirect: {redirect_uri}?code={code}&state={state}
3. AlixWork empfängt code + state → serverseitig alix-id-token
     Input: code, code_verifier, redirect_uri
     Server:
       - findet Transaktion per Hash
       - prüft: nicht used_at, nicht expired, redirect_uri match, PKCE verify
       - markiert used_at, status='consumed' (Race-safe via UPDATE ... WHERE used_at IS NULL RETURNING)
       - erstellt eigene AlixWork-Session (HttpOnly-Cookie) mit identity_id, org_id, permissions
       - schreibt alix_security_events (app_opened + code_consumed)
4. AlixWork wendet weiterhin bestehende RLS-Policies (customer_portal_users)
   an — SSO ersetzt keine Feinberechtigungen.
```

Wichtige Härtungen:
- Codes sind an `identity_id + application_id + redirect_uri + code_challenge` gebunden.
- Nur SHA-256-Hash wird gespeichert; Klartext existiert nur im Redirect.
- `used_at IS NULL` als optimistischer Lock verhindert Doppel-Einlösung.
- Kein Zugriffs-Token in URLs; App bekommt HttpOnly-Cookie über Server.
- Redirect-URIs werden gegen `alix_applications.redirect_uris` exakt gematcht (keine Wildcards).

## Änderungen in Sub-Phase 3a

- Neue Migration `20260716_alix_id_foundation` — 8 Tabellen, RLS-Policies, 2 Helper, Backfill-Funktion, Seed aller 9 geplanten Apps.
- Diese Dokumentation `docs/alix-id-phase3.md`.

Keine Änderungen an Auth-User, Kunden, Mandanten, Portal-Zugängen,
customer_portal_users, RLS-Regeln von Phase 1/2 oder Storage.

## Rollback 3a

```sql
DROP FUNCTION IF EXISTS public.alix_id_bootstrap_from_portal_users();
DROP FUNCTION IF EXISTS public.has_alix_id_permission(text);
DROP FUNCTION IF EXISTS public.current_alix_identity_id();
DROP TABLE IF EXISTS public.alix_id_admin_permissions CASCADE;
DROP TABLE IF EXISTS public.alix_security_events CASCADE;
DROP TABLE IF EXISTS public.alix_auth_transactions CASCADE;
DROP TABLE IF EXISTS public.alix_identity_app_access CASCADE;
DROP TABLE IF EXISTS public.alix_identity_organizations CASCADE;
DROP TABLE IF EXISTS public.alix_applications CASCADE;
DROP TABLE IF EXISTS public.alix_organizations CASCADE;
DROP TABLE IF EXISTS public.alix_identities CASCADE;
```

Kein Portal-Feature ist auf diese Objekte angewiesen; Rollback trifft nur
noch nicht produktiv verwendete Strukturen.

## Offene Punkte (bewusst nicht in 3a)

- Backfill wurde nur bereitgestellt, aber noch nicht ausgeführt — soll erst
  laufen, wenn 3b (Edge Functions) und 3c (UI) getestet sind.
- Keine UI-Änderung an bestehenden Portalen in 3a.
- Domain `id.alixwork.de` noch nicht konfiguriert (technisch vorbereitet,
  aber SSO läuft in 3b vorerst unter `/id/*` derselben Origin).
