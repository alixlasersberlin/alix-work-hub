## WhatsApp Service Center – Umsetzungsplan

Modulares Add-on, keine bestehenden Funktionen/Tabellen verändert. Bindet WhatsApp Cloud API über eine Edge Function an das bestehende Ticket-Modul + AlixSmart-Sync an.

### 1. Datenbank (Migration)

Neue Tabellen im `public`-Schema (mit GRANTs + RLS):

- **`whatsapp_conversations`** – `customer_phone`, `customer_name`, `linked_customer_id` → `customers.id`, `linked_ticket_id` → `tickets.id`, `status` (open/closed/archived), `assigned_department` (service/technik/finance/tourenplanung), `assigned_to`, `unread_count`, `opt_out`, `last_message_at`.
- **`whatsapp_messages`** – `conversation_id`, `ticket_id`, `direction` (in/out), `sender_name`, `sender_phone`, `message_text`, `media_url`, `media_type`, `whatsapp_message_id` (unique), `status` (sent/delivered/read/failed/received), `is_internal_note` (immer false für WhatsApp – nur interne Notizen leben weiterhin in `tickets`/`ticket_messages`).
- **`whatsapp_sync_logs`** – `action`, `status`, `error_message`, `payload`, `created_at`.
- **`whatsapp_templates`** – vorgefertigte Standardantworten (`key`, `title`, `body`, `language`, `active`). Wird mit den 7 geforderten Vorlagen geseedet.

Storage-Bucket **`whatsapp-media`** (privat) für Bilder/PDFs/Videos vom Kunden + ausgehende Anhänge.

RLS / Rollenrechte über bestehende Helper:
- Lesen: Admin, `Kundenservice`, `Technik` (Department=technik), `Finance` (Department=finance), `Tourenplanung` (Department=tourenplanung).
- Schreiben/Antworten: Admin, `Kundenservice`. Technik darf interne Notizen am verknüpften Ticket setzen.
- Delete/Archivieren: nur Super Admin (folgt globaler Regel).
- Opt-out-Flag pro Konversation, blockiert ausgehenden Versand.

### 2. Edge Functions

- **`whatsapp-webhook`** (`verify_jwt=false`, public) – GET: Meta-Verify (`hub.challenge`); POST:
  1. Signatur via `WHATSAPP_APP_SECRET` (HMAC SHA256) prüfen.
  2. Nachricht parsen (Text/Media), Media-File von Meta laden und in `whatsapp-media` ablegen.
  3. Konversation per `customer_phone` upsert; Kunde via `customers.phone`/`mobile` mappen.
  4. Auto-Erkennung: Regex auf Seriennummer (`SN…`), Auftragsnummer (Zoho-Format), Fehlercodes → Ticket-Match.
  5. Offenes Ticket finden (`tickets.customer_id` + `status≠closed`) oder neues Ticket anlegen (`source='whatsapp'`, `priority='Normal'`, `department='service'`).
  6. Message persistieren, an `ticket_messages` spiegeln (öffentlich).
  7. `whatsapp_sync_logs` Eintrag + Aufruf des bestehenden AlixSmart-Sync-Pfads (analog zu Tickets-Modul) via interner RPC/Function.

- **`whatsapp-send`** (`verify_jwt=true`) – sendet Text/Template/Media über Cloud API (`/messages`). Prüft Auth + Rolle, Opt-out, internal-note-Flag (Block), schreibt `whatsapp_messages` (direction=out, status=sent) und mirror in `ticket_messages`.

Secrets: `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`. Werden via Secret-Prompt angefordert, sobald der Plan freigegeben ist.

### 3. Frontend

Route `/whatsapp` (lazy, Sidebar unter „Tickets"):

- **`WhatsAppInbox.tsx`** – Liste offener Gespräche (Kunde, Telefon, letztes Datum, Ticket-Nr., Status, ungelesen-Badge), Filter nach Department + Suche.
- **`WhatsAppChat.tsx`** – Detailansicht: Chronologischer Verlauf, Realtime-Subscribe auf `whatsapp_messages`, Kundenkarte (inkl. Gerät/Seriennummer aus erkanntem Ticket), Aktionen-Bar:
  - Antworten (Text + Anhang + Template-Picker)
  - Interne Notiz (geht in `ticket_messages`, **nicht** an WhatsApp)
  - Ticket erstellen / verknüpfen (`OrderPickerDialog`-Pattern)
  - Kunde zuordnen (Customer-Search-Dialog)
  - An Technik übergeben (setzt `assigned_department='technik'`, Ticket-Department-Update)
  - Opt-out / Archivieren (rolle-geprüft)

Zugriffsschutz im Router via `requiredRoles=['Super Admin','Admin','Kundenservice','Technik','Finance','Tourenplanung']`; UI-Aktionen pro Rolle gegated.

### 4. Standardantworten

`whatsapp_templates` wird mit den 7 Items geseedet (key/title/body), Template-Picker im Chat füllt das Eingabefeld vor; bei Verwendung eines Meta-zertifizierten Templates wird der Cloud-API-Template-Endpoint genutzt, sonst freier Text.

### 5. Sicherheit & Datenschutz

- Webhook-Signaturprüfung Pflicht.
- Tokens ausschließlich serverseitig (`Deno.env.get`); Frontend ruft nur `whatsapp-send`.
- Interne Notizen technisch getrennt (`ticket_messages.is_internal=true`) und nie an `whatsapp-send` übergeben.
- Opt-out-Konversationen blocken jeden Outbound mit 403.
- Volles Audit über `whatsapp_sync_logs` + bestehende `audit_logs`.

### Nicht enthalten / Annahmen

- Provider = WhatsApp Cloud API (Meta). Falls 360dialog/Twilio gewünscht: separater Adapter, gleiche Tabellen.
- AlixSmart-Sync nutzt den bereits bestehenden Ticket-Sync; keine neue externe API.
- Realtime nur auf `whatsapp_messages` (Supabase Realtime), kein zusätzliches Push.

### Reihenfolge

1. Migration + Storage-Bucket + Seed-Templates.
2. Secrets-Prompt (4 Stück).
3. Edge Functions `whatsapp-webhook` + `whatsapp-send`.
4. Frontend `WhatsAppInbox` + `WhatsAppChat` + Route + Sidebar.
5. Memory-Eintrag.

OK so umsetzen?
