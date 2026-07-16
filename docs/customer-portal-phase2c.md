# Kundenportal — Sub-Phase 2c: Edge Functions & elektronische Signatur

Serverseitige Verarbeitung aller schreibenden Kundenaktionen, OTP-basierte
Vertragssignatur und interne Benachrichtigungen. Phase 1 und 2a/2b bleiben
unverändert.

## Neue Edge Functions

Alle Funktionen erwarten ein gültiges Supabase-Session-Bearer-Token eines
aktiven `customer_portal_users`-Eintrags. Alle prüfen `customer_id` +
`customer_visible`, schreiben Audit-Log und benachrichtigen optional
`SUPPORT_NOTIFY_EMAIL` / `PRIVACY_NOTIFY_EMAIL` via Resend, falls konfiguriert.

| Function | Zweck |
| --- | --- |
| `portal-offer-action` | Angebot annehmen / ablehnen (immutable Beweisrow, offizieller Status-Update) |
| `portal-contract-sign-request` | 6-stelligen OTP für Vertragssignatur per E-Mail senden |
| `portal-contract-sign-confirm` | OTP prüfen, immutable Signatur schreiben, Vertragsstatus auf `signed` setzen |
| `portal-message-send` | Nachricht in Thread posten oder neuen Thread starten |
| `portal-maintenance-request` | Wartungs-/Reparaturanfrage einstellen |
| `portal-document-download` | Kurzlebige Signed URL für ein freigegebenes Dokument |
| `portal-data-request` | DSGVO-Anfrage (Export/Löschung/Berichtigung/Einschränkung) |

Shared Helper: `supabase/functions/_shared/portal-auth.ts` (Auth,
Audit-Insert, Resend-Mail, OTP-Generator).

## Sicherheitsprinzipien

- **Zero-Trust**: Jede Function validiert Bearer-Token, portal-user-Binding
  und `customer_id` erneut. Kein Vertrauen auf Payload-Werte.
- **Signaturbeweis unveränderlich**: `customer_portal_contract_signatures`
  hat nur `SELECT` und `INSERT` für Rollen; `service_role` schreibt nur
  einmal, danach kein Update-Pfad.
- **OTP**: 6-stellig, SHA-256-gehashed mit `contract_id + user.id` als
  Bindung, 10 Minuten Ablauf, Einmal-Verwendung (Löschung nach Erfolg).
- **Signed URLs**: 60 Sekunden Lebensdauer, jeder Download wird in
  `customer_portal_document_downloads` protokolliert.
- **Enumeration-Schutz**: Alle Nicht-Berechtigungsfehler antworten mit
  `not_found` statt `forbidden`.
- **Idempotenz**: `portal-offer-action` blockiert Doppel-Annahmen pro
  `offer_id + version`.

## Optionale Secrets

| Secret | Wirkung |
| --- | --- |
| `RESEND_API_KEY` | Aktiviert Mailversand (OTP + Admin-Benachrichtigungen) |
| `SUPPORT_NOTIFY_EMAIL` | Empfänger für interne Portal-Events |
| `PRIVACY_NOTIFY_EMAIL` | Empfänger für DSGVO-Anfragen (Fallback auf SUPPORT) |

Ohne diese Secrets funktioniert alles außer der E-Mail-Versand — Aktionen
werden trotzdem persistiert und auditiert.

## UI-Anpassungen

- `OfferDetail`: Ruft `portal-offer-action` statt Direct-Insert.
- `ContractsV2`: Zeigt Signatur-Status und Button „Jetzt signieren" für
  freigegebene, noch nicht signierte Verträge.
- `ContractSignDialog`: Zweistufiger Flow (Consent + Name → OTP-Eingabe).

## Testprotokoll

1. Angebot annehmen ohne Login → 401.
2. Angebot annehmen eines fremden Kunden → 404 (`not_found`).
3. Angebot zweimal annehmen → zweiter Aufruf 409 (`already_recorded`).
4. Signatur-Confirm ohne vorheriges Request → 400 (`invalid_or_expired_code`).
5. OTP nach 11 Min → 400.
6. Document Download eines fremden `document_id` → 404.
7. DSGVO-Request mit falscher `kind` → 400.

## Rollback

```sh
# Edge Functions in Supabase Dashboard löschen:
# portal-offer-action, portal-contract-sign-request, portal-contract-sign-confirm,
# portal-message-send, portal-maintenance-request, portal-document-download,
# portal-data-request
# UI-Rollback: ContractSignDialog entfernen, OfferDetail auf direct-insert
# (siehe git history 2b) zurücksetzen.
```

## Offene Punkte (für Sub-Phase 2d)

- Admin-Tab „Portal-Freigaben" mit `customer_visible`-Toggles.
- Signierte PDF-Erzeugung nach `contract_sign_confirm` (aktuell nur Status).
- Rate-Limiting pro portal-user (aktuell nur globale Supabase-Limits).
- E-Mail-Templates via React Email statt Inline-HTML.

## Übergang zu 2d

- Admin-Screens für Angebote/Verträge freigeben und Signaturen einsehen.
- Sicherheitstests (Pentest-Checkliste, RLS-Fuzzing) automatisieren.
- Phase 3: Alix ID SSO für AlixWork, AlixSmart, Academy, Mediapaket.
