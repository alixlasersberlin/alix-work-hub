# Alix ID — Sub-Phase 3f: MFA-Enforcement (Minimum)

Sub-Phase 3f schaltet die MFA-Pflicht für Apps mit
`alix_applications.requires_mfa = true` scharf. Damit können die in 3g
konfigurierten Apps **Alix Studio**, **eAnamnese** und **Alix Finance**
produktiv aktiviert werden.

Umfang bewusst minimal: **nur** Enforcement. Passkey-Registrierung und
Risk-Scoring bleiben späteren Sub-Phasen vorbehalten.

## Was ändert sich

### `alix-id-authorize` (Edge Function)

Nach dem Access-Check zusätzlich:

```
if (app.requires_mfa) {
  aktive_mfa =
    (user_mfa_secrets.enrolled_at IS NOT NULL
     AND user_mfa_secrets.totp_confirmed_at IS NOT NULL
     AND user_mfa_secrets.disabled_at IS NULL)
    OR
    exists(mfa_webauthn_credentials WHERE user_id = auth.uid());

  if (!aktive_mfa) → 403 { error: "mfa_required" }
                    + security_event "sso_authorize_denied" reason=mfa_required
}
```

Wichtig:
- Kein Effekt auf Apps mit `requires_mfa = false` (AlixSmart, Academy,
  Medi Metropole, Mediapaket, AlixWork Customer-Portal).
- MFA-Prüfung basiert auf bestehenden Tabellen (`user_mfa_secrets`,
  `mfa_webauthn_credentials`) — keine neuen Migrationen nötig.

### `/id/apps` (App-Picker)

Fängt den Fehler `mfa_required` aus `alix-id-authorize` ab und leitet
den Nutzer auf `/id/sicherheit` weiter (Toast: „Für diese App ist
Zwei-Faktor-Authentifizierung Pflicht."). Nach Aktivierung von TOTP/Passkey
kann der Nutzer die App erneut öffnen.

## Was **nicht** in 3f enthalten ist

- WebAuthn-Registrierungs-Flow neben TOTP (kommt später).
- Risk-Scoring / Device-Trust / IP-Geo-Blocking.
- Erzwungene MFA-Re-Enrollment nach Passwort-Reset.
- Zwang zur MFA-Aktivierung bereits beim Alix-ID-Login (nur beim
  App-Zugriff auf MFA-Pflicht-Apps).

## Test-Plan

| Fall | App | Nutzer-Status | Erwartung |
| --- | --- | --- | --- |
| MFA-App, kein MFA | alix_studio | kein TOTP, kein Passkey | 403 `mfa_required`, Weiterleitung auf `/id/sicherheit` |
| MFA-App, TOTP aktiv | alix_studio | `totp_confirmed_at != NULL` | 302 → `/sso/callback?code=…` |
| MFA-App, Passkey aktiv | eanamnese | ≥1 `mfa_webauthn_credentials`-Zeile | 302 → `/sso/callback?code=…` |
| MFA-App, TOTP disabled | alix_finance | `disabled_at != NULL` | 403 `mfa_required` |
| Nicht-MFA-App | alixsmart | egal | 302 → `/sso/callback?code=…` |
| Security-Event geloggt | alle | — | `alix_security_events.reason='mfa_required'` |

## Rollback

Nur Code — kein Schema. Rollback = MFA-Block-Block aus
`supabase/functions/alix-id-authorize/index.ts` entfernen und neu
deployen. Alle Apps funktionieren dann wieder ohne MFA-Zwang.

## Freigabe für 3g-Produktivaktivierung

Nach erfolgreichem Test-Plan dürfen die MFA-Apps aus 3g in
`/id-admin/applications` auf `active` gesetzt werden — einzeln, in der
Reihenfolge Studio → eAnamnese → Finance.
