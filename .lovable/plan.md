# Phase 10a — Zero-Trust-Baseline (Gerätefreigabe, Offline-Wipe, Domain)

Umgesetzt in einem Rutsch. Was jetzt aktiv ist:

## 1. Gerätefreigabe-Workflow ✅

**Migration**: `mobile_push_subscriptions` erweitert um
- `device_name, os, browser, app_version, ip_hint`
- `approval_status` (`pending`/`approved`/`blocked`) mit Check-Constraint
- `approved_at, approved_by, blocked_at, blocked_by, block_reason`
- Auto-Approve aller Bestandsgeräte (kein Ausloggen).
- Neue RLS-Policies: Super Admin & Admin dürfen ALLE Geräte lesen und ändern.
- SECURITY-DEFINER-Funktion `is_device_active(sub_id)` (nur `authenticated`/`service_role`).

**Client**:
- `src/lib/device-info.ts` – best-effort UA-Parsing (OS, Browser, Gerätename, App-Version).
- `usePushSubscription.subscribe()` schickt Device-Info + IP-Hint (server-seitig aus X-Forwarded-For) beim Registrieren mit.

**Server-Gate**:
- `push-subscribe` speichert Device-Info in DB.
- `reminder-scheduler` filtert vor jedem Push auf `approval_status='approved' AND blocked_at IS NULL`. Gesperrte Geräte bekommen keine Nachrichten mehr – auch wenn die Subscription technisch noch existiert.

**Admin-UI**: `/admin/geraete` (Super Admin & Admin)
- Zähler pending/approved/blocked, Filter, Volltextsuche.
- Freigeben / Sperren (mit optionalem Grund) / Zurücksetzen.
- Zeigt Nutzer, Gerät, OS, Browser, IP, Registrierungs- und Zuletzt-Aktiv-Zeit.

## 2. Offline-Daten-Wipe beim Logout ✅

`useAuth.signOut()` löscht jetzt vor `supabase.auth.signOut()`:
- Kalender-Outbox (`clearQueue()`).
- Alle projekteigenen IndexedDB-Datenbanken (`alixwork*`, `kalender*`, `dispatch*`, `offline*`).
- `sessionStorage` komplett.

Damit bleiben nach Abmeldung (auch nach Fern-Sperrung des Geräts durch Admin, wenn der Nutzer sich neu einloggen muss) keine Kalender-, Termin- oder Kunden-Fragmente lokal zurück.

## 3. Auto-Logout nach Inaktivität ✅ (bereits vorher)

Bestehende 30-Minuten-Inaktivitätslogik in `useAuth` bleibt bestehen. Ein Re-Auth-Modal vor sensiblen Kundendaten (KYC-artig) baue ich in Phase 10b zusammen mit MFA.

## 4. Domain-Umzug auf `app.alixwork.de`

Musst du im Lovable-UI machen (DNS-Kontrolle liegt bei dir):

1. **Project Settings → Domains → Connect Domain**
2. Domain: `app.alixwork.de` eintragen.
3. DNS-Einträge bei deinem Registrar setzen:
   - `A` `app` → `185.158.133.1`
   - `TXT` `_lovable.app` → Wert aus dem Setup-Dialog
4. Warten bis Status = **Active** (SSL wird automatisch bereitgestellt).
5. Alte `alix-pro-hub.lovable.app`-URL bleibt weiter erreichbar für interne Bookmarks; sobald `app.alixwork.de` läuft, kannst du sie in Publish Settings als Primary setzen.

Weil Publish-Visibility bereits auf `private` steht (Phase davor), sperrt auch `app.alixwork.de` alle Nicht-Workspace-Mitglieder aus.

## Phase 10b (nächster Turn, wenn du willst)

- MFA-Pflicht (TOTP + WebAuthn/Passkey) für Super Admin/Admin/Geschäftsführung.
- Re-Auth-Modal vor sensiblen Kundendaten-Aktionen.
- `mfa-enroll` / `mfa-verify` Edge Functions, Migration für `user_mfa_secrets` + Recovery Codes + WebAuthn-Credentials.
