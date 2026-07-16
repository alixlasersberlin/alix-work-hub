# Kundenportal Phase 2+ — Umsetzungsplan

Aufbauend auf bestehendem Portal (Phase 1 Login/OTP/Rechnungen/Meine Daten + bereits vorhandene Phase-2-Basis Geräte/Verträge/Tickets). Phase 1 bleibt unverändert. AlixWork bleibt Master. Kunde hat nur eng definierte Schreibrechte.

Weil der Umfang enorm ist, teile ich in **vier Sub-Phasen** und liefere jede Sub-Phase in einem eigenen, prüfbaren Schritt.

---

## Sub-Phase 2a — Fundament (Sicherheit, RLS, Rollen, Portal-Flag = 3)

**Datenbank (Migration, alle mit RLS + GRANTs, keine Tabelle wird gelöscht):**

Neu:
- `customer_portal_offer_acceptances` — Rechtsnachweis Angebotsannahme (offer_id, customer_id, tenant_id, auth_user_id, name, funktion, ip, ua, pdf_hash, consent_text, offer_version, accepted_at). Immutable.
- `customer_portal_contract_signatures` — Vertrags­signatur (contract_id, contract_version, customer_id, tenant_id, auth_user_id, name, funktion, signature_png_path, pdf_hash, otp_challenge_id, consents jsonb, ip, ua, signed_at). Immutable.
- `customer_portal_messages` + `customer_portal_message_threads` — sichere Nachrichten (thread_id, department, subject, body, attachments, direction, read_at). Kein DELETE für Kunden.
- `customer_portal_documents` — kuratierte Dokumentenablage (tenant_id, customer_id, device_id, doc_type, doc_number, title, storage_bucket, storage_path, file_hash, version, customer_visible, published_at, expires_at). Nur `customer_visible=true` sichtbar.
- `customer_portal_notifications` — In-Portal-Benachrichtigungen (title, body, target_route, priority, read_at).
- `customer_portal_maintenance_requests` — Wartungsanfragen des Kunden (device_id, wunsch_zeitraum, standort, kontakt, beschreibung, geraet_nutzbar, attachments).
- `customer_portal_data_requests` — DSGVO-Anfragen (Löschung/Auskunft/Korrektur), keine automatische Löschung.

Ergänzungen an bestehenden Tabellen (ADD COLUMN IF NOT EXISTS):
- `offers`: `customer_visible boolean default false`, `portal_published_at`, `portal_version int default 1`, `portal_pdf_hash text`, `accepted_at`, `accepted_by_name`, `declined_reason`.
- `finance_contracts`: `customer_visible boolean default false`, `signature_status text`, `signed_pdf_path text`, `contract_version int default 1`.
- `device_maintenance` / Serviceberichte: `customer_visible boolean default false`.
- `warranty_records` / `warranty_decisions`: `customer_visible boolean default false`.
- `lager_devices`: `image_url text` (falls fehlt) — nur wenn nicht schon vorhanden.

RLS-Prinzip (jede Tabelle einzeln, SELECT/INSERT/UPDATE getrennt):
- Lesen: `tenant_id = current_portal_tenant_id() AND customer_id = current_portal_customer_id() AND customer_visible = true` (wo anwendbar).
- Schreiben: nur für definierte Kunden-Aktionen (Angebot annehmen/ablehnen, Vertrag signieren, Ticket erstellen/antworten, Wartung anfragen, Nachricht senden, Benachrichtigung lesen, Datenanfrage). Alles andere ausschließlich `service_role` via Edge Functions.
- Neue SECURITY DEFINER Funktion `current_portal_tenant_id()` analog zu `current_portal_customer_id()`.

Neue Berechtigungen (in bestehendem Rollensystem eintragen):
`customer_portal.offers.{view,publish,manage}`, `.contracts.{view,publish,manage}`, `.devices.{view,assign}`, `.warranty.{view,publish}`, `.maintenance.{view,manage}`, `.tickets.{view,reply}`, `.messages.{view,send}`, `.documents.{view,publish}`, `.audit.view`, `.sessions.manage`. **Nicht** automatisch verteilt.

Audit-Actions erweitert: `offer_opened/downloaded/accepted/declined`, `contract_opened/downloaded/signed`, `device_opened`, `warranty_opened`, `maintenance_requested`, `ticket_created/replied`, `file_uploaded`, `message_sent/read`, `document_opened/downloaded`, `notification_read`.

Feature-Flag: `PORTAL_PHASE = 3`.

**Rollback:** Neue Tabellen droppen, `customer_visible`-Spalten belassen (default false = kein Kundenzugriff), Flag auf 2 zurück.

---

## Sub-Phase 2b — Kunden-UI (Portal)

Neue Portal-Seiten unter `src/pages/CustomerPortal/`:
- `OffersV2.tsx` + `OfferDetail.tsx` (annehmen/ablehnen inkl. Bestätigungsdialog, Signaturhash)
- `ContractsV3.tsx` + `ContractDetail.tsx` mit Signaturflow (Canvas-Signatur + OTP-Zweitbestätigung via Edge Function)
- `DevicesV3.tsx` mit Karten + Detailtabs (Übersicht/Garantie/Wartung/Reparatur/Dokumente/Schulungen/Tickets)
- `Warranty.tsx`
- `MaintenanceV2.tsx` inkl. Anfrageformular (Uploads in privaten Bucket)
- `MessagesV2.tsx` (Threads pro Abteilung)
- `DocumentsV2.tsx` (Kategorien, signierte 60s-URLs)
- `NotificationsCenter.tsx` + Bell im Header, Badges im Menü
- `Security.tsx` (Sessions/Login-Historie, maskierte IP)
- Erweiterte `Dashboard.tsx` (alle geforderten Kacheln + Schnellzugriff)
- Slide-in-Menü mobil in `Layout.tsx`

Design: bestehendes weiß / dunkles Silber / Gold, semantische Tokens, keine Farben hartcodiert.

---

## Sub-Phase 2c — Edge Functions & E-Mails

Neue Functions (alle mit CORS, JWT-Prüfung, Zod-Validierung, `service_role` nur intern):
- `portal-offer-accept` — Prüft Version/Ablauf, erzeugt Nachweis + Bestätigungs-PDF, benachrichtigt Vertrieb, Mail an Kunde.
- `portal-offer-decline` — Grund + optionaler Text, Benachrichtigung intern.
- `portal-contract-sign-otp` — sendet 6-stelligen Code an hinterlegte Mail via Resend.
- `portal-contract-sign` — verifiziert OTP, speichert Signatur, hängt Signaturseite an PDF, sperrt Vertrag.
- `portal-maintenance-request` — legt AlixWork-Serviceanfrage an, benachrichtigt Serviceteam.
- `portal-message-send` — schreibt Nachricht, Benachrichtigungs-Mail ohne Inhalt.
- `portal-notify` — generischer Trigger für neue Rechnung/Angebot/etc. (per DB-Trigger).
- `portal-document-download` — signierte URL 60s, Audit.
- `portal-upload` — Whitelist (PDF/JPG/PNG/HEIC/MP4/MOV), Größe, MIME/Extension-Vergleich, Rename auf UUID.
- `portal-sessions` — Liste + Beenden.

E-Mail-Templates (Resend) — nur allgemeiner Hinweis + Portal-Link, keine sensiblen Daten:
`offer_new`, `offer_accepted`, `contract_new`, `contract_to_sign`, `contract_signed`, `document_new`, `ticket_created`, `ticket_replied`, `maintenance_reminder`, `portal_message`.

Storage: bestehende private Buckets nutzen; neu `portal-uploads` (privat) für Kunden-Uploads.

---

## Sub-Phase 2d — AlixWork Admin + Tests + Doku

Admin-Kundenprofil `CustomerDetail.tsx` bekommt Tab **„Kundenportal 2.0"** mit Untertabs: Übersicht, Portalzugang, Rechnungen, Angebote, Verträge, Geräte, Garantie, Wartungen, Tickets, Nachrichten, Dokumente, Sitzungen, Audit-Log. Aktionen (Sichtbarkeit umschalten, veröffentlichen, Session beenden, Zugang deaktivieren) berechtigungsgesteuert.

Sicherheitstests (Playwright-Script + SQL-Checks): alle 20 geforderten Fälle als Skript unter `docs/portal-phase2plus-tests.md` + automatisierte Regressionsprüfung der RLS mit einem zweiten Testkunden.

Dokumentation: `docs/customer-portal-phase2plus.md` mit allen Tabellen, RLS-Regeln, Buckets, Functions, E-Mails, Audit-Events, Rollback.

---

## Reihenfolge & Freigaben

Ich fahre in Reihenfolge 2a → 2b → 2c → 2d. Nach **2a (Migration)** brauche ich deine Freigabe im Migrations-Review, weil viele Tabellen und Spalten neu sind. Danach laufen 2b–2d weitgehend ohne weitere DB-Änderungen.

Bitte bestätige den Plan (oder sag mir, welche Sub-Phase du zuerst willst). Bei "ok" starte ich mit 2a und lege die Migration zur Freigabe vor.
