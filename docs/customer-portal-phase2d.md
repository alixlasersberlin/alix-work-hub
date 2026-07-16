# Kundenportal — Sub-Phase 2d: Admin-Freigaben & Sicherheitstests

Interne Admin-Oberfläche zum Kuratieren des Portal-Contents und Testkatalog
für die Phase-2-Sicherheitsprüfung. Phase 1, 2a–2c bleiben unverändert.

## Neue Admin-Seite

Route: `/portal-admin/freigaben` — nur `Super Admin` und `Admin`.

Tabs:

| Tab | Aktion |
| --- | --- |
| Angebote | `offers.customer_visible` per Switch umschalten |
| Verträge | `finance_contracts.customer_visible` + Signaturstatus einsehen |
| Dokumente | `customer_portal_documents.customer_visible` freigeben/entziehen |
| Signaturen | Read-only Log aller `customer_portal_contract_signatures` (immutable) |
| Angebots-Aktionen | Read-only Log aller `customer_portal_offer_acceptances` |
| Wartungsanfragen | Read-only Übersicht `customer_portal_maintenance_requests` |
| DSGVO | Read-only Übersicht `customer_portal_data_requests` |

Bearbeitung erfolgt nur über den `customer_visible`-Toggle; die eigentlichen
Beweisdaten (Signaturen, Acceptances) sind **nicht editierbar**.

## Testprotokoll (manuell + Skript)

### RLS-Isolation
1. Kunde A meldet sich an, ruft `/kunde/angebote` → sieht ausschließlich Angebote
   mit `customer_id = A` **und** `customer_visible = true`.
2. Direkter API-Call mit A-Token gegen `/rest/v1/offers?customer_id=eq.<B>` →
   leeres Ergebnis (RLS).
3. Kunde A ruft `portal-document-download` mit fremdem `document_id` →
   `not_found`.
4. Kunde A ruft `portal-offer-action` für Angebot von Kunde B → `not_found`.

### Immutable Beweise
5. Direkt-Update auf `customer_portal_contract_signatures` als authenticated →
   0 Zeilen betroffen (kein UPDATE-Policy).
6. DELETE via authenticated → 0 Zeilen.

### OTP-Härtung
7. `portal-contract-sign-confirm` mit falschem Code → `invalid_or_expired_code`
   und Audit-Log `contract_otp_failed`.
8. Nach erfolgreichem Confirm ist der OTP-Row in `customer_portal_notifications`
   gelöscht (nicht wiederverwendbar).
9. OTP nach 11 Minuten → `invalid_or_expired_code`.

### Idempotenz
10. `portal-offer-action` zweimal (accept + accept) → zweiter Aufruf
    `already_recorded` (409).

### Storage-Isolation
11. Kunde A lädt Datei in `portal-uploads/<B>/foo.pdf` (raw SDK) → RLS-Fehler.
12. Kunde A liest `portal-uploads/<B>/foo.pdf` → 404 (RLS auf `storage.objects`).

### Enumeration / Missing Auth
13. Alle Portal-Edge-Functions ohne `Authorization` → 401.
14. `PORTAL_PHASE` in `src/lib/portal/phase.ts` auf 1 gesetzt → Kunden sehen
    nur Phase-1-Routen, alle 2b-Routen ergeben 404.

### Audit-Vollständigkeit
15. Für jede Kundenaktion existiert ein Eintrag in `customer_portal_audit_logs`
    mit korrekter `action`, `customer_id`, `auth_user_id`, `ip_address`,
    `user_agent`.

## Automatisiertes Smoke-Skript

Ein Deno-Skript unter `supabase/functions/_shared/portal-smoke.md` beschreibt
die manuellen Curl-Aufrufe (Bearer-Token via Portal-Login). Volle
Playwright-Automatisierung folgt separat, da Phase-1-Auth einen echten E-Mail-
OTP-Roundtrip voraussetzt.

## Empfohlene Secrets (Betrieb)

| Secret | Zweck |
| --- | --- |
| `RESEND_API_KEY` | E-Mail-Versand (OTP + Admin-Benachrichtigungen) |
| `SUPPORT_NOTIFY_EMAIL` | Interne Portal-Events |
| `PRIVACY_NOTIFY_EMAIL` | DSGVO-Anfragen (Fallback → SUPPORT) |

## Rollback

- Route `/portal-admin/freigaben` in `src/App.tsx` entfernen.
- Datei `src/pages/PortalReleases.tsx` löschen.
- Kein Datenbank-Rollback nötig (Toggle schreibt nur `customer_visible`).

## Offene Punkte / Übergang zu Phase 3

- Signierte PDF-Generierung nach `contract_sign_confirm` (PDF-Hash aktuell
  aus `signed_pdf_path`; Renderer folgt).
- Rate-Limiting pro portal-user (aktuell nur Supabase-Defaults).
- SEPA-/Bonitäts-Freigaben im Portal (nur Anzeige).
- **Phase 3: Alix ID** — SSO über AlixWork, AlixSmart, Academy, Mediapaket,
  Multi-Faktor-Policy auf zentraler Alix-ID.

## Änderungen dieser Sub-Phase

- `src/pages/PortalReleases.tsx` (neu)
- `src/App.tsx` (Route + Lazy-Import)
- `docs/customer-portal-phase2d.md` (dieses Dokument)
