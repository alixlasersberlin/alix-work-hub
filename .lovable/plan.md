
# Phase 10b — MFA & Re-Auth (Zero-Trust Stufe 2)

Ziel: Super Admin / Admin / Geschäftsführung können sich ohne aktive 2FA **nichts** mehr ansehen. Zusätzlich muss der Nutzer vor sensiblen Aktionen (Kundendaten öffnen, Finance-Auszahlungen, Rollen ändern, Gerätefreigabe) sein Passwort **oder** einen TOTP/Passkey neu bestätigen.

## Umfang

### 1. Datenbank (Migration)
- `user_mfa_secrets` erweitern (aktuell nur 3 Spalten):
  - `totp_secret` (verschlüsselt, base32), `totp_confirmed_at`, `enrolled_at`, `disabled_at`
- Neue Tabelle `mfa_recovery_codes` (user_id, code_hash, used_at) — 10 Einmalcodes.
- Neue Tabelle `mfa_webauthn_credentials` (user_id, credential_id, public_key, counter, transports, device_label, last_used_at) für Passkeys.
- Neue Tabelle `mfa_reauth_events` (user_id, method, purpose, verified_at, expires_at) — kurzlebige Re-Auth-Tickets (5 min).
- SECURITY-DEFINER-Funktion `public.mfa_required_for_user(uid uuid) → boolean`: true wenn User eine der Rollen Super Admin/Admin/Geschäftsführung hat.
- SECURITY-DEFINER-Funktion `public.has_valid_reauth(uid uuid, purpose text) → boolean`.
- Alle Grants + RLS wie in privacy-Regeln (nur eigene Zeilen, service_role voll).

### 2. Edge Functions
- `mfa-enroll-totp`: erzeugt Secret, liefert `otpauth://`-URI + QR-SVG (Base64), speichert **unbestätigt**.
- `mfa-verify-totp`: prüft 6-stelligen Code (HMAC-SHA1, RFC 6238, ±1 Fenster), setzt `totp_confirmed_at`, generiert 10 Recovery-Codes (nur einmal angezeigt).
- `mfa-webauthn-register-options` / `mfa-webauthn-register-verify` (via `@simplewebauthn/server`).
- `mfa-webauthn-auth-options` / `mfa-webauthn-auth-verify`.
- `mfa-reauth`: nimmt TOTP-Code **oder** Passkey-Assertion **oder** Passwort entgegen, erzeugt Re-Auth-Event (5 min gültig) für angegebenen `purpose`.
- Alle mit `getClaims()` JWT-Check.

### 3. Frontend

**Erzwungener MFA-Setup:**
- Neue Route `/mfa/setup` (kein Layout-Wrap, kein Sidebar).
- `useAuth` prüft nach Login: wenn `mfa_required_for_user()` = true **und** kein `totp_confirmed_at` → hartes Redirect auf `/mfa/setup`, Rest der App gesperrt (Router-Guard).
- Setup-Screen: QR-Code scannen, Code eingeben, Recovery-Codes anzeigen + Download-Button.

**Login-Flow:**
- Nach Passwort-Login prüft ein neuer Schritt, ob TOTP oder Passkey vorhanden → Challenge-UI (`/mfa/challenge`) vor Erreichen der App.
- Passkey-Option als primärer Button, TOTP als Fallback, Recovery-Code als Notausgang.

**Re-Auth-Modal** (`src/components/ReauthDialog.tsx` existiert bereits – erweitern):
- Wird via Hook `useReauthGate(purpose)` an sensible Aktionen gehängt:
  - Kundendaten-Detail öffnen (`/kunden/:id`)
  - Finance-SEPA/Auszahlungs-Freigabe
  - Rollen-Änderungen (`/admin/rollen`, `/admin/geraete` Sperren)
  - Bug&CAPA-Löschungen
- Modal: Passkey-Button + TOTP-Feld + „Passwort erneut eingeben"-Fallback.
- Nach Erfolg: 5 min lang cached (`has_valid_reauth`) — kein Modal-Spam.

**MFA-Verwaltung** unter `/einstellungen/sicherheit`:
- TOTP-Status (aktiv/inaktiv), Passkey-Liste (hinzufügen/entfernen), Recovery-Codes neu generieren.

### 4. Abhängigkeiten
- `bun add @simplewebauthn/browser @simplewebauthn/server qrcode otpauth`
- Secret `MFA_ENCRYPTION_KEY` für TOTP-Secret-Verschlüsselung (via `generate_secret`, 64 chars).
- Secret `WEBAUTHN_RP_ID` = `alixwork.de` (bzw. `app.alixwork.de` sobald live).

### 5. Rollout-Sicherheit
- Migration setzt für alle Bestands-Admins `mfa_required_for_user()` = true, aber **Grace-Period** von 7 Tagen (Warn-Banner statt Sperre). Dafür Spalte `mfa_grace_until` in `user_profiles`.
- Super Admin kann in `/admin/rollen` einzelne User temporär von der Pflicht ausnehmen (auditiert).

## Technische Notizen

- TOTP: `otpauth`-lib (Deno-kompatibel via `npm:otpauth`), Algorithmus SHA1, 30s Fenster, 6 Digits (kompatibel mit Google Authenticator, 1Password, Authy).
- WebAuthn RP: Origin muss exakt matchen — für Dev separat `localhost` als RP-ID, für Prod `app.alixwork.de`. Wird per Env-Var gesteuert.
- Re-Auth-Ticket-Tabelle mit TTL-Cleanup-Cron (bestehender `reminder-scheduler` kann das mitmachen).
- Recovery-Codes werden mit `crypto.subtle.digest('SHA-256')` gehasht gespeichert, nie im Klartext.

## Nicht enthalten
- SMS-2FA (bewusst weggelassen: SIM-Swap-Risiko + Kosten).
- Hardware-Security-Keys separat: durch WebAuthn/Passkey automatisch mit abgedeckt.
- Enforcement für „normale" Rollen (Order, QM, Österreich etc.) — bleibt optional, kann pro User aktiviert werden.

## Umfang / Aufwand
Rund 15 neue/geänderte Dateien, 1 Migration, 6 Edge Functions, 3 neue Routen. Baue ich in einem Rutsch, sobald du „ok" sagst.

**Frage:** Soll die 7-Tage-Grace-Period rein (empfohlen — verhindert Aussperrung im Live-Betrieb), oder sofort-hart ab Deployment?
