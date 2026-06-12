# Alix Sign — Elektronische Angebotsannahme

Additive Integration in `/verkauf/angebote`. Keine bestehende Funktion wird entfernt; vorhandene Buttons („Signieren", Speichern, PDF) bleiben.

## Architektur-Hinweis (wichtig)
Angebote werden heute ausschließlich im Browser-`localStorage` (`alix_angebote_v1`) gespeichert — es gibt keine `offers`-Tabelle. Damit der Kunde ein Angebot über einen öffentlichen Link sehen kann, wird beim Erstellen einer Signaturanfrage ein **vollständiger Snapshot des Angebots** (Kunde, Positionen, Summen, Zahlungsart) in `alix_sign_requests.offer_payload jsonb` mitgespeichert. `offer_id` bleibt textbasiert (= `offer_number`, z. B. `ANG-2026-10403`), weil keine UUID existiert.

## 1. Datenbank (3 neue Tabellen, additiv)

`alix_sign_requests`
- offer_number text, offer_payload jsonb (Snapshot), customer_id uuid (nullable, FK customers)
- token text unique, status text (`erstellt|gesendet|geöffnet|unterschrieben|abgelehnt|abgelaufen`)
- expires_at, opened_at, signed_at, created_by uuid, created_at, updated_at

`alix_sign_signatures`
- sign_request_id uuid FK, offer_number text, customer_id uuid
- signer_name, signer_email, signer_location
- signature_image_path (Storage), ip_address inet, user_agent text
- accepted_offer, accepted_terms, accepted_privacy, accepted_electronic_signature, accepted_credit_check (bool)
- pdf_path text, pdf_hash text, created_at

`alix_sign_audit_log`
- sign_request_id uuid FK, action text, details jsonb, ip_address inet, user_agent text, created_at

**Storage-Bucket** `alix-sign` (privat) für Signaturbilder + signierte PDFs.

**RLS / GRANTs**
- Interne Tabellen: SELECT/INSERT/UPDATE für Rollen `Super Admin`, `Admin`, `Order`, `Vertrieb`, `Finance`, `Geschäftsführung` (via `has_role()`). DELETE nur Super Admin.
- Öffentlicher Zugriff ausschließlich über Edge Functions (Service Role) — keine `anon`-Policies auf den Tabellen.

## 2. Edge Functions (public, ohne JWT)

- `alix-sign-create` — interne Auth (Bearer Session). Erzeugt Token (32B random), speichert Snapshot, schickt E-Mail an Kunde via vorhandener Lovable Email-Infrastruktur.
- `alix-sign-get` — `GET ?token=…` → liefert nur das, was die öffentliche Seite braucht (Snapshot + Status). Setzt `opened_at` + Audit-Eintrag. Verweigert bei abgelaufen/unterschrieben.
- `alix-sign-submit` — `POST { token, signer_*, accepted_*, signature_png_base64 }`. Validiert (Zod), Token prüft, Signaturbild → Storage, generiert signiertes PDF (Original-Angebot + Signaturseite mit Audit-Trail) via `jsPDF` in Deno, speichert PDF + SHA-256-Hash, schreibt `alix_sign_signatures` + Audit, setzt Request `unterschrieben`, sendet Bestätigungs-E-Mail an Kunde + interne Benachrichtigung an Sales/Finance (vorhandene `mail_internal_messages`).

## 3. E-Mail-Vorlagen (Lovable Emails, additiv)

- `alix-sign-invite` — Einladung mit Signatur-Link (Wortlaut wie spezifiziert).
- `alix-sign-confirmation` — Bestätigung nach Signatur, signiertes PDF als Download-Link.
- Interne Benachrichtigung läuft über bestehende `mail_internal_messages`-Tabelle (keine neue Vorlage nötig).

## 4. Frontend

**Öffentliche Route** `/sign/:token` (außerhalb Auth-Wrapper, ähnlich `/portal`):
- Lädt via `alix-sign-get`. Zeigt Angebotsnummer, Kunde, Positionen, Summen, Zahlungsart.
- Hinweise: AGB, Datenschutz, ggf. Bonitätsprüfung (nur bei Finanzierung/Mietkauf/Leasing/Alix Flex).
- Eingabefelder: Vorname, Nachname, E-Mail, Ort (Datum automatisch).
- 3 Pflicht-Checkboxen + 4. konditional.
- Signatur-Canvas (Maus/Touch) mit „Leeren" und „Verbindlich unterschreiben".
- Nach Erfolg: Dankeseite + Download-Link für signiertes PDF.

**Im internen Bereich** `src/pages/AngebotErstellen.tsx` und `src/pages/Angebote.tsx`:
- Neuer Button **„Mit Alix Sign zur Unterschrift senden"** im Angebot-Formular (zusätzlich; bestehender „Signieren"-Button bleibt).
- Neuer Tab/Drawer **„Alix Sign"** mit: Signaturstatus, Link erstellen, Link kopieren, erneut senden, Ablaufdatum, Audit-Log, signiertes PDF herunterladen.
- Bei Status `unterschrieben` wird das Angebot in der Liste schreibgeschützt markiert (Bearbeiten-Button deaktiviert), Hinweis „durch Alix Sign verbindlich angenommen".
- Status-Feld am Angebot (im `alix_angebote_v1`-Snapshot) wird parallel gepflegt — bestehende Status-Logik unangetastet, neue Werte werden additiv ergänzt.

## 5. „In Auftrag umgewandelt"
Da Aufträge aus Zoho stammen und nicht hier angelegt werden, wird nach Signatur **kein** automatischer Order-Datensatz erzeugt — stattdessen erscheint im internen Angebot ein Button „Als Auftrag übernehmen" (manueller Schritt, vorhandene Logik), und der Status wechselt erst dann auf „In Auftrag umgewandelt". So bleibt die Zoho-Quelle unangetastet.

## 6. Sicherheit
- Token: 32 Byte CSPRNG, base64url, einmalig.
- Ablauf: 14 Tage default (in `app_settings` konfigurierbar).
- Nach Signatur: Request- und Signaturdaten read-only. Snapshot ist eingefroren.
- Rate-Limit auf `alix-sign-submit` via vorhandener `check_rate_limit`.
- IP + User-Agent aus Request-Headern.
- Service-Role nur in Edge Functions, nie im Browser.

---

## Reihenfolge der Umsetzung
1. Migration: Tabellen + Storage + RLS + GRANTs.
2. Edge Functions `alix-sign-create`, `alix-sign-get`, `alix-sign-submit`.
3. E-Mail-Vorlagen + Registry.
4. Öffentliche Route `/sign/:token` + Komponenten (Canvas, Form).
5. Interne UI: Button + Alix-Sign-Tab im Angebot.
6. Sperrlogik in `Angebote.tsx` (Edit deaktiviert bei `unterschrieben`).

Soll ich so vorgehen?
