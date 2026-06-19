## Neuer Reiter „SMS Versand" in der Auftragskunden-Akte

Ergänzt die bestehende Kundenakte (`/kunden/:id`) um einen weiteren Tab — ohne bestehende Tabs, PDF-Generatoren oder Datenstrukturen zu ändern.

### 1. Edge Function `send-customer-sms` (neu)
- Wiederverwendet vorhandene Twilio-Secrets `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN`.
- Neues Secret `TWILIO_SMS_FROM_NUMBER` (separat von WhatsApp-From), falls noch nicht vorhanden — sonst fällt sie auf `TWILIO_WHATSAPP_FROM_NUMBER` ohne `whatsapp:`-Präfix zurück.
- Validiert JWT via `getClaims`, prüft Rolle serverseitig (Admin/Super Admin/Vertrieb/Kundenservice/Finance/Service/Reparaturannahme).
- Body: `{ customer_id, document_id, document_type, document_number, recipient_name, phone, text }`.
- Normalisiert Telefonnummer auf E.164 (`+49…`), validiert Format.
- Erzeugt **signierten Download-Link** für das PDF:
  - bevorzugt vorhandene `order_documents.download_token` (genutzt von `od-download`),
  - falls keiner existiert: kurzlebigen Signed-URL aus dem passenden Storage-Bucket (`order-invoices`, `repair-*`, …) mit 30-Tage-Ablauf,
  - kürzt via Token-Route `/d/:token` (existiert bereits über `od-download`).
- Ersetzt `{{kunde}}` / `{{link}}` Platzhalter, sendet via Twilio `Messages.json` (SMS, kein `whatsapp:`).
- Loggt Ergebnis in `customer_sms_logs` (success + error path).

### 2. Neue Tabelle `customer_sms_logs`
Felder: `customer_id`, `order_id?`, `document_id?`, `document_type`, `document_number`, `phone`, `message_text`, `link_url`, `twilio_sid`, `status` (`queued|sent|failed|delivered|undelivered`), `error_message`, `sent_by` (uuid), `sent_at`.
GRANTs für `authenticated` + `service_role`, RLS:
- SELECT/INSERT für Nutzer mit den o.g. Rollen (via vorhandene Helper wie `is_admin()`, `has_role(...)`),
- service_role darf alles (für Twilio-Status-Webhook-Updates später).

### 3. Frontend: neuer Tab in `src/pages/CustomerDetail.tsx`
- Tab nur sichtbar, wenn `useAuth().isAdmin` ODER eine der freigegebenen Rollen erfüllt ist (Helper-Check über `user_roles`).
- Neue Komponente `src/components/CustomerSmsTab.tsx`:
  - Lädt alle Dokumente des Kunden aus `order_documents` (joined über `orders.customer_id = :id`) inkl. Typ, Nummer, `created_at`, Status, `download_token`.
  - Lädt zusätzlich Reparatur-PDFs (`repair_orders` + `repair_quotes` + Berichte) über vorhandene Pfade.
  - Tabelle mit Spalten: Typ · Nummer · Datum · Status · „PDF öffnen" · „per SMS senden".
  - „PDF öffnen" nutzt vorhandene Download-Route (`/d/:token` → `od-download` Edge Function) — kein neuer Generator.
  - „per SMS senden" öffnet Dialog (shadcn `Dialog`): Empfängername, Mobilnr. (vorbelegt aus `customers.phone`), Dokument, editierbarer Standardtext, Button „SMS senden".
  - Validierung clientseitig (Telefon vorhanden + E.164-fähig, PDF/Token vorhanden).
  - Templates pro Dokumenttyp wie im Briefing.
  - Unter der Tabelle: Versandhistorie aus `customer_sms_logs` (Datum, Dokument, Nummer, Status-Badge, Text-Snippet, Button „erneut senden").

### 4. Konfiguration
- `supabase/config.toml`: `[functions.send-customer-sms] verify_jwt = true`.
- Memory-Eintrag `mem://features/customer-sms` + Index-Update.

### Nicht angefasst
- Keine Änderungen an bestehenden PDF-Generatoren, Tabs, Routen, RLS anderer Tabellen, WhatsApp-Function oder Storage-Policies.

### Offene Punkte
- Bestätige bitte: Reparatur-PDFs (Kostenvoranschlag, Reparaturbericht) liegen ebenfalls in `order_documents`? Falls in eigenen Tabellen, ergänze ich die Quellen entsprechend.
- Soll ein zusätzliches Secret `TWILIO_SMS_FROM_NUMBER` angelegt werden, oder die WhatsApp-From-Nummer als Fallback nutzen?
