# Kundenportal Phase 1 — Manuelle Sicherheits- & Abnahmetests

Diese Checkliste muss vor jedem Rollout an echte Kunden vollständig durchlaufen werden.
Ergebnisse (Datum, Tester, Pass/Fail, Notiz) bitte in `docs/portal-phase1-tests-runs/<datum>.md` protokollieren.

Testumgebung: Preview (nicht Prod). Testkunde: **Alix Test Portal** (customer_id in `.env.test` hinterlegt).

---

## A. Login & OTP

| # | Testfall | Erwartung |
|---|---|---|
| A1 | Login mit unbekannter E-Mail | Neutrale Meldung ("Falls die E-Mail hinterlegt ist …"), kein Enumeration-Leak, kein OTP-Versand |
| A2 | Login mit bekannter, **aktiver** Portal-E-Mail | OTP-Mail kommt an, 6-stelliger Code, gültig |
| A3 | Login mit bekannter Portal-E-Mail, Status `disabled` | OTP wird trotzdem *nicht* akzeptiert → nach `verifyOtp` sofort `signOut` + Hinweistext |
| A4 | Falscher Code 5× hintereinander | Sperre 15 Min lokal + Audit-Eintrag `login_rate_limited` |
| A5 | Richtiger Code nach Ablauf (>5 Min) | Fehler, kein Login |
| A6 | Login von zwei Geräten | Beide Sessions gültig; Admin kann sie beenden (Abschnitt E) |
| A7 | Idle 30 Min im Portal | Automatischer Logout, Redirect `/kunde/login` |

## B. RLS — Rechnungen (`mail_attachments`)

| # | Testfall | Erwartung |
|---|---|---|
| B1 | Portal-User A liest eigene Rechnungen | Nur Zeilen mit `customer_id = A` und `document_type='Rechnung'` |
| B2 | Portal-User A versucht direkt `select` auf `mail_attachments` fremder `customer_id` (via SQL/Netzwerk-Manipulation) | 0 Zeilen — RLS blockt |
| B3 | Portal-User A versucht Zeile mit `document_type='Lieferschein'` zu lesen | 0 Zeilen |
| B4 | Interner AlixWork-Mitarbeiter (nicht Portal) liest weiter alles | Unverändert, keine Regression |

## C. Storage / signierte Download-URLs

| # | Testfall | Erwartung |
|---|---|---|
| C1 | Direkter Bucket-Zugriff ohne Signatur | 403 |
| C2 | `portal-invoice-download` mit gültiger `attachment_id` des eigenen Kunden | Signed URL (60 s), Download funktioniert |
| C3 | `portal-invoice-download` mit `attachment_id` eines **fremden** Kunden | 403, Audit `invoice_download_denied` |
| C4 | Signed URL nach 61 s erneut aufrufen | 400/403 (Ablauf) |
| C5 | `portal-invoice-download` ohne gültiges JWT | 401 |

## D. Meine Daten

| # | Testfall | Erwartung |
|---|---|---|
| D1 | Anzeige Firmenname/Adresse/Kundennummer | Read-only, exakt aus `customers` |
| D2 | "Datenänderung mitteilen" | Neuer Eintrag in `customer_portal_tickets` (`type=data_change_request`), kein Update auf `customers` |
| D3 | Versuch via DevTools ein `update` auf `customers` zu senden | RLS blockt |

## E. AlixWork Admin-Tab „Kundenportal"

| # | Testfall | Erwartung |
|---|---|---|
| E1 | Rolle Super Admin öffnet Tab | Alle Aktionen sichtbar |
| E2 | Rolle ohne `customer_portal.view` | Tab nicht sichtbar / 403 in Edge Function |
| E3 | Aktivieren eines neuen Portalkunden | `customer_portal_users` Zeile `status=active`, Invite-Mail geht raus, Audit-Eintrag |
| E4 | Deaktivieren | `status=disabled`, nächster OTP-Login schlägt fehl (siehe A3) |
| E5 | Login-E-Mail ändern | Auth-Mail aktualisiert, Audit-Eintrag, alte Sessions revoked |
| E6 | „Alle Sitzungen beenden" | Betroffener User wird beim nächsten Request abgemeldet |
| E7 | Audit-Log-Viewer | Zeigt letzte Aktionen, sortiert, nur eigener Kunde |

## F. Feature-Flag (`PORTAL_PHASE=1`)

| # | Testfall | Erwartung |
|---|---|---|
| F1 | Direktaufruf `/kunde/bestellungen`, `/kunde/geraete`, `/kunde/tickets` etc. | Redirect auf `/kunde` |
| F2 | Sidebar/Navigation | Nur Übersicht, Rechnungen, Meine Daten, Abmelden |

## G. Datenschutz & Header

| # | Testfall | Erwartung |
|---|---|---|
| G1 | Response-Header `/kunde` | `X-Frame-Options`, `Referrer-Policy`, keine Marketing-Cookies |
| G2 | Datenschutz- und Impressumslink im Footer | Vorhanden und funktionsfähig |
| G3 | `robots` für `/kunde/*` | `noindex, nofollow` |

## H. Audit-Log-Vollständigkeit

Erwartete Einträge nach einem vollständigen Kunden-Lebenszyklus:
`portal_activated` → `invite_sent` → `login_success` → `invoice_viewed` → `invoice_download` → `data_change_request` → `login_logout` → (Admin) `session_revoked` → `portal_deactivated`.

Alle mit korrekter `customer_id`, `auth_user_id`, `ip_address`, `user_agent`.

---

## Rollback

Siehe `docs/customer-portal-phase1.md` §Rollback. Kurzform:
1. Feature-Flag `PORTAL_PHASE=0` → Portal offline.
2. `customer_portal_users.status='disabled'` für alle Test-Accounts.
3. Migration ist additiv — keine Rückmigration nötig, außer Tabelle `customer_portal_audit_logs` soll entfernt werden (`drop table` in Wartungsfenster).

## Freigabe

Erst nach 100 % Pass in A–H und Gegenzeichnung durch **Geschäftsleitung** + **Datenschutz** darf Phase 1 an echte Kunden ausgerollt werden.
