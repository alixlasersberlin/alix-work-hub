# Alix ID — Produktive App-Aktivierung (Rollout-Log)

Stand: 16. Juli 2026

## Übersicht

| App | `app_key` | `app_status` | MFA-Pflicht | Testreihe grün | Aktiviert am |
| --- | --- | --- | --- | --- | --- |
| AlixWork | `alixwork` | ✅ active | – | ✅ (Phase 3d) | Phase 3d |
| AlixSmart | `alixsmart` | ✅ active | – | ✅ (Phase 3g) | Phase 3g |
| Alix Academy | `alix_academy` | ✅ active | – | ✅ | 16.07.2026 |
| Medi Metropole | `medi_metropole` | ✅ active | – | ✅ | 16.07.2026 |
| Mediapaket | `mediapaket` | ✅ active | – | ✅ | 16.07.2026 |
| Alix Studio | `alix_studio` | ⏸ inactive | ✅ ja | ⏳ offen | – |
| eAnamnese | `alix_eanamnese` | ⏸ inactive | ✅ ja | ⏳ offen | – |
| Alix Finance | `alix_finance` | ⏸ inactive | ✅ ja | ⏳ offen | – |

## Freigabe-Kriterien (MFA-Apps)

Damit Studio / eAnamnese / Finance auf `active` gehen dürfen, MUSS pro App
folgende Reihe erfolgreich durchlaufen:

1. **Testnutzer ohne MFA** → `alix-id-authorize` liefert `403 {error:"mfa_required"}`,
   Portal-Toast erscheint, Weiterleitung nach `/id/sicherheit`.
2. **Testnutzer enrollt TOTP** unter `/id/sicherheit` (Secret + Verify).
3. **Erneuter App-Klick** → `302` mit `code` + `state` an registrierten `redirect_uri`.
4. **`alix-id-token`** tauscht Code binnen 60 s → `200` mit HttpOnly-Cookie.
5. **Zweiter Tausch desselben Codes** → `400 code_used` (Race-Schutz).
6. **`alix_security_events`** enthält `app_opened` + `code_consumed`, keine
   `mfa_required`-Reste.

Erst nach grüner Reihe: `UPDATE alix_applications SET app_status='active' WHERE app_key='…';`

## Rollback

Pro App einzeln in `/id-admin/applications` auf `disabled` (oder Emergency-Lock
in `/id-admin/emergency-lock`). Bereits ausgestellte Codes verfallen nach 60 s;
Sessions werden über `alix-id-logout` bzw. Idle-Timer beendet.
