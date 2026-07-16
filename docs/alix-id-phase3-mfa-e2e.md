# Alix ID — Phase 3f/3g MFA-Enforcement E2E-Test

Stand: 16. Juli 2026

## Ziel

Reproduzierbarer Freigabe-Test für die drei MFA-pflichtigen Apps (Alix Studio,
eAnamnese, Alix Finance), bevor sie in `alix_applications.app_status='active'`
geschaltet werden. Ersetzt den manuellen 403→302→200-Test.

## Komponenten

- **Edge Function** `alix-id-mfa-e2e` — läuft serverseitig, benötigt
  Alix-ID-Admin-Recht `manage_application` (Super Admin implizit erlaubt).
  Verwendet `SUPABASE_SERVICE_ROLE_KEY` aus der Edge-Function-Umgebung.
- **UI-Trigger** in `/id-admin/applications` (Karte oberhalb der Applikationen).
- **Cleanup** ist Teil des Tests selbst: alle angelegten Rows (`auth.users`,
  `alix_identities`, `alix_organizations`, `alix_identity_app_access`,
  `user_mfa_secrets`, `alix_auth_transactions`, `alix_security_events`)
  werden nach Abschluss gelöscht; `redirect_uris` und `app_status` der App
  werden auf den Ausgangswert zurückgesetzt.

## Ablauf pro App

| # | Schritt | Erwartung |
|---|---------|-----------|
| 1 | `auth.admin.createUser` + Identity + Org + Access seed'en | success |
| 2 | Redirect-URI `https://e2e.alix.local/sso/callback` temporär zulassen, `app_status='active'` erzwingen | success |
| 3 | `signInWithPassword` → Bearer JWT | success |
| 4 | `alix-id-authorize` **ohne** TOTP | `403 { error: "mfa_required" }` |
| 5 | `user_mfa_secrets` upsert (`totp_confirmed_at`, `enrolled_at`) | success |
| 6 | `alix-id-authorize` erneut | `200 { redirect: "…?code=…&state=…" }` |
| 7 | State-Rückgabe & Code-Länge prüfen | state match, code >20 Zeichen |
| 8 | `alix-id-token` mit korrektem PKCE-Verifier | `200`, `application.key`, `identity.auth_user_id` passt |
| 9 | Zweiter `alix-id-token` mit demselben Code | `400` (code_used) |
| 10 | Cleanup (siehe oben) | best effort |

## Aufruf

**Aus der Admin-UI:**  `/id-admin/applications` → Karte oben → **„Test starten"**.
Ergebnis pro App als PASS/FAIL mit Detail-Log pro Step.

**Aus einem Skript/CI (Beispiel):**

```bash
curl -X POST "$SUPABASE_URL/functions/v1/alix-id-mfa-e2e" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"app_keys":["alix_studio","alix_eanamnese","alix_finance"]}'
```

## Freigabekriterium

Erst nach `{ ok: true }` für die betroffene App darf per
`UPDATE alix_applications SET app_status='active' WHERE app_key='…'` geschaltet
werden. Danach ist Rollback wie in `docs/alix-id-phase3-activation.md` beschrieben.

## Log

Das Ergebnis wird als `alix_security_events.event_type =
'mfa_e2e_test_pass' | 'mfa_e2e_test_fail'` mit Payload
`{ by, apps, results:[{app, ok}] }` protokolliert.
