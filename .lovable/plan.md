## Ziel

Jeder Login erfordert künftig nach Passwort einen 6-stelligen TOTP-Code aus einer Authenticator-App (Google Authenticator, Authy, 1Password etc.). Der Eintrag in der App heißt **ALIX WORK**. Das bisherige E-Mail/SMS-OTP entfällt.

---

## Ablauf für den User

1. **Login** mit E-Mail + Passwort wie bisher.
2. **Wenn noch kein Authenticator eingerichtet ist** → erzwungene Setup-Seite:
   - QR-Code (Issuer: `ALIX WORK`, Account: E-Mail) + manueller Secret-Key
   - User scannt mit App, gibt aktuellen 6-stelligen Code ein
   - Nach erfolgreicher Verifizierung werden **8 einmalige Recovery-Codes** angezeigt (nur einmal sichtbar, müssen sicher gespeichert werden)
   - Erst danach Zugang zur App.
3. **Wenn Authenticator schon eingerichtet ist** → Challenge-Seite, 6-stelliger Code wird bei jedem Login abgefragt.
4. **Verlust des Geräts**: User klickt „Recovery-Code verwenden", gibt einen seiner 8 Codes ein. Der Code wird verbraucht, sein Authenticator-Faktor wird zurückgesetzt, beim nächsten Login muss er neu einrichten.
5. **Admin-Reset**: In der User-Verwaltung gibt es pro User einen Button „2FA zurücksetzen". Damit muss der User beim nächsten Login neu einrichten.

---

## Umsetzung (technisch)

### Datenbank (Migration)
- `user_profiles` um zwei Spalten erweitern:
  - `mfa_enrolled_at timestamptz null`
  - `mfa_recovery_codes_hash text[] not null default '{}'` (SHA-256 der Klartext-Codes)
- Trigger `check_user_profile_self_update` so anpassen, dass User diese beiden Felder bei sich selbst schreiben dürfen.

Keine neue Tabelle. Faktoren-Verwaltung übernimmt Supabase Auth selbst (`auth.mfa_factors`).

### Edge Functions
- `mfa-store-recovery-codes` – generiert 8 Codes, speichert Hashes auf eigenem Profil, gibt Klartext einmalig zurück.
- `mfa-use-recovery-code` – prüft Code gegen Hash, entfernt verbrauchten Hash und löscht alle TOTP-Faktoren des Users via Admin-API (zwingt Re-Enrollment).
- `mfa-admin-reset` – nur Admin: löscht Faktoren + Recovery-Codes eines Ziel-Users.

Bestehende `send-otp-challenge` / `verify-otp-challenge` werden nicht mehr aufgerufen, bleiben aber im Repo (können später entfernt werden).

### Frontend
- **`useAuth`**: ergänzen um aktuelles AAL (`aal1`/`aal2`) und MFA-Status (enrolled / not enrolled).
- **Routing-Guard** in `App.tsx`:
  - Eingeloggt + nicht enrolled → Redirect auf `/mfa-setup`
  - Eingeloggt + enrolled + AAL=aal1 → Redirect auf `/mfa-challenge`
  - Erst bei AAL=aal2 darf die App betreten werden.
- **Neue Seiten**:
  - `/mfa-setup`: ruft `supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'ALIX WORK', friendlyName: 'ALIX WORK' })`, zeigt QR + Secret, verifiziert Code, dann Recovery-Codes-Anzeige mit Pflicht-Bestätigung „Habe ich gespeichert".
  - `/mfa-challenge`: Eingabe 6-stelliger Code, Link „Recovery-Code verwenden".
  - `/mfa-recovery`: Eingabe Recovery-Code → Aufruf Edge Function → Logout → Hinweis „Bitte neu anmelden und Authenticator erneut einrichten".
- **`Login.tsx`**: bisherige OTP-Schritte entfernen, nach erfolgreichem Passwort-Login wird vom Guard auf Setup oder Challenge umgeleitet.
- **`ReauthDialog.tsx`**: bleibt vorerst, ruft aber statt E-Mail-OTP eine TOTP-Challenge auf (separater optionaler Schritt – kann auch deaktiviert werden, da Login bereits AAL2 erzwingt).
- **`UserManagement.tsx`**: pro User Button „2FA zurücksetzen" → Edge Function `mfa-admin-reset`.

### Issuer / Anzeige in der App
Der String `ALIX WORK` wird sowohl als `issuer` als auch als `friendlyName` beim Enroll übergeben. Damit erscheint in Google Authenticator: **ALIX WORK (user@example.com)**.

---

## Was sich für bestehende User ändert

- Beim nächsten Login werden alle User direkt auf `/mfa-setup` geleitet und müssen einmalig einrichten – kein optionaler Übergang.
- E-Mail-OTPs werden nicht mehr versendet.

---

## Voraussetzung in Supabase Dashboard

In **Authentication → Providers → MFA** muss **TOTP** aktiviert sein. Das ist meist Standard, ich gebe nach der Migration einen Hinweis-Link, falls beim Testen ein Fehler auftritt.

---

## Reihenfolge der Änderungen

1. Migration (DB-Spalten + Trigger-Anpassung)
2. Edge Functions (3 Stück)
3. `useAuth` + Routing-Guard
4. Setup-, Challenge-, Recovery-Seite
5. Admin-Reset in UserManagement
6. Login-Seite OTP-Schritte entfernen

Soll ich so umsetzen?