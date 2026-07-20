# ALIX CONNECT HUB — Omnichannel Customer Communication Center

Erweiterung von ALIX CONNECT zu einer vollständigen Omnichannel-Plattform (Teamchat + LiveChat + Social + Twilio + CRM + Marketing) für alle Mandanten der ALIX-Gruppe. Vollständig integriert in AlixWork, mandantenfähig, RBAC-gesichert, Supabase-basiert.

## Scope & Grundprinzipien

- **Mandantenfähig**: Nutzt bestehende `tenants` + `user_tenant_access` Tabellen (Alix Lasers, Alix Medical, Medi Metropole, Beauty Island, AlixSmart, eAnamnese, NiSV Online, ...)
- **RBAC**: Admin/Super Admin volle Verwaltung, neue Rolle „Communication Agent" für operative Nutzung, „Marketing" für Kampagnen
- **Zero-Trust**: Widget-Endpoints öffentlich, aber signiert (HMAC + Rate-Limit); Inbox nur intern
- **Kein Doppel-Bau**: Wo möglich, existierende Tabellen wiederverwenden (`customers`, `sales_leads`, `tickets`, `whatsapp_messages`, `mail_messages`, `customer_sms_logs`, `esc_events`, `customer_portal_*`)

---

## Phase 1 — Foundation (Modul 21 + 25 Basis)

**Datenmodell (neue Tabellen, alle mit RLS, GRANTs, tenant_id):**

- `connect_channels` — Kanal-Konfiguration pro Mandant (webchat, whatsapp, sms, email, fb_messenger, ig_direct, telegram, teams)
- `connect_conversations` — Universelle Unterhaltung (tenant_id, channel_id, customer_id?, lead_id?, assigned_to?, status, priority, unread_count, last_message_at, source_domain, meta jsonb)
- `connect_messages` — Alle ein-/ausgehenden Nachrichten (conversation_id, direction, sender_type, body, attachments jsonb, delivery_status, external_message_id)
- `connect_participants` — Mitarbeiter/Agenten pro Conversation
- `connect_tenant_branding` — Logo, Farben, Fonts, Begrüßung, Impressum, Datenschutz, Öffnungszeiten pro Mandant
- `connect_agent_status` — presence (online/away/offline), max_concurrent

**Frontend:**

- Menü **ALIX CONNECT → Inbox** (`/connect/inbox`) — Unified Inbox mit Kanal-Filter, Mandant-Switcher, Suche
- **Conversation View** — 3-Spalten (Liste | Chat | Kontakt-Panel)
- **Kontakt-Panel** (Modul 25): Live-Anzeige aus `customers`, offene Tickets, Aufträge, Rechnungen, Geräte/Seriennummern, Garantie, letzte Kommunikation

**Backend Edge Functions:**

- `connect-inbox-list`, `connect-conversation-messages`, `connect-send-message` (channel-aware Dispatcher)

---

## Phase 2 — LiveChat Widget (Modul 22 + 26 Basis)

**Widget (`public/widget/alix-connect.js` + `WidgetHost.tsx`):**

- Standalone JS-Bundle, auf beliebiger Domain einbindbar: `<script src="https://alixwork.de/widget/alix-connect.js" data-tenant="alix-lasers"></script>`
- Auto-Load Branding via Domain → `connect-widget-config` Edge Function
- Features: Text, Emoji, Datei-Upload (PDF/Bild/Video), Voice Recording, Typing-Indikator, Read-Receipts, Online-Status, Warteschlange, Offline-Formular, Auto-Übersetzung (Gemini), Schnellantworten, KI-Erstantwort
- Responsive: Desktop / Tablet / Mobile / PWA

**Lead-Auto-Capture (Modul 26):**

- Bei erster Widget-Interaktion → automatischer Eintrag in `sales_leads` (bestehende Tabelle) mit UTM, Referrer, IP-Land (DSGVO: nur Land, keine volle IP), besuchte Seiten, Verweildauer, Lead-Score
- Realtime-Übergabe an Agent

**Storage:** Bucket `connect-widget-uploads` (private, signed URLs)

---

## Phase 3 — Social & Twilio Integration (Modul 23 + 24)

**Twilio Hub (Modul 24):**

- Nutzt bestehenden `twilio` Connector via Gateway
- Edge Functions:
  - `connect-twilio-send` (SMS/WhatsApp/Voice)
  - `connect-twilio-inbound-webhook` (öffentlich, HMAC-signiert)
  - `connect-twilio-status-webhook` (Delivery-Callbacks)
- Blacklist-Tabelle `connect_opt_outs`, Templates aus `connect_templates`, Massenversand-Runner

**Social Channels (Modul 23):**

- Facebook Messenger + Instagram Direct → Meta Graph Webhook (`connect-meta-webhook`)
- WhatsApp Business Cloud API → parallel zu Twilio-WhatsApp wählbar pro Mandant
- E-Mail → wiederverwendet bestehende `mail_messages` (Bridge-Trigger schreibt Conversation)
- Telegram + Teams: als **Phase-6-Optional** markiert, Schema vorbereitet

Alle inbound Messages laufen in **eine** `connect_conversations`.

---

## Phase 4 — CRM, Templates, Kampagnen (Modul 27–30)

**Kundenlisten & Segmentierung (Modul 27):**

- Neue Seite `/connect/segmente` — visueller Query-Builder
- Filter: Firma, Land, Gerät, Seriennummer, Interessent/Bestandskunde/Partner, Newsletter-Freigabe, letzter Kontakt, Garantieende, offene Rechnungen, AlixSmart-Status
- Gespeicherte Segmente in `connect_segments` (JSON-Filter, dynamisch)

**Vorlagenmanager (Modul 29):**

- Tabelle `connect_templates` (channel, language, category, body, variables, attachments, buttons, version, approved_by)
- KI-Generierung via Gemini
- Freigabe-Workflow (Draft → Review → Approved)

**Kampagnen (Modul 28):**

- Tabelle `connect_campaigns` + `connect_campaign_recipients`
- Aus Segment → Kampagne starten (Chat/WhatsApp/SMS/E-Mail/Push)
- Zeitgesteuert (Cron), Personalisierung `{{Vorname}}` etc.
- Tracking: Sent, Delivered, Opened, Clicked, Replied, Unsubscribed
- Öffnungs-/Klickraten-Dashboard

**CRM-Verknüpfung (Modul 30):**

- Jede `connect_messages` → automatisch `customer_communication_log` Eintrag (bestehend)
- Trigger: bei Verknüpfung zu Auftrag/Ticket/Gerät → in `mail_messages`/`ticket_messages`-Historie mirroren

---

## Phase 5 — Kundenportal + Dashboard (Modul 31 + 32)

**Kundenportal-Integration (Modul 31):**

- Widget erkennt eingeloggten Kunden (Cookie/Portal-Token) → auto-verknüpft mit `customer_portal_users`
- Chat-Aktionen: Ticket öffnen, Rechnung herunterladen, Dokument hochladen, Garantie prüfen, Termin buchen (`esc_events`)
- Quick-Action-Buttons im Widget

**Management Dashboard (Modul 32):**

- Neue Seite `/connect/dashboard`
- Live-KPIs (Supabase Realtime): aktive Besucher, laufende Chats, Ø Antwortzeit, Wartezeit, Leads heute/Woche
- Conversion-Raten Chat→Angebot / Chat→Auftrag, Umsatz aus Chats
- Kanal-Statistiken (SMS/WhatsApp/E-Mail), Agentenleistung, KI-Nutzung
- CSAT (Post-Chat-Umfrage), NPS, SLA-Erfüllung

---

## Phase 6 — Optional / Erweiterungen

- Telegram + Microsoft Teams (App User Connector, per Mandant)
- Voice/Video-Calls im Widget (WebRTC via Twilio)
- KI-Autopilot (Gemini): Intent-Erkennung, Auto-Routing, Sentiment-Analyse
- White-Label-Domains pro Mandant (`chat.alix-medical.de` etc.)

---

## Technische Details

**Neue Tabellen:** ~15 (`connect_*`), alle mit `tenant_id`, RLS via `has_role()` + `user_tenant_access`, GRANTs für authenticated/service_role, Realtime auf `connect_conversations` + `connect_messages`.

**Wiederverwendet:** `tenants`, `user_tenant_access`, `customers`, `sales_leads`, `tickets`, `customer_communication_log`, `whatsapp_messages`, `mail_messages`, `customer_sms_logs`, `esc_events`, `customer_portal_users`.

**Edge Functions:** ~12 (`connect-inbox-list`, `connect-send-message`, `connect-widget-config`, `connect-widget-message` (public+HMAC), `connect-twilio-*`, `connect-meta-webhook`, `connect-campaign-runner`, `connect-segment-preview`, `connect-ai-suggest`).

**Storage:** `connect-widget-uploads` (private), `connect-tenant-branding` (public — nur Logos/Farben).

**Connectors:** Twilio (bereits vorhanden), optional Meta (manual OAuth), Telegram (BotAPI), Microsoft Teams (App User Connector).

**Menü-Struktur:**
```text
ALIX CONNECT
├── Inbox                    (Agents+)
├── LiveChat-Widget          (Admin)
├── Segmente                 (Marketing+)
├── Kampagnen                (Marketing+)
├── Vorlagen                 (Marketing+)
├── Dashboard                (Admin+)
└── Einstellungen            (Super Admin)
    ├── Mandanten-Branding
    ├── Kanäle
    ├── Automationen
    └── Öffnungszeiten
```

**Rollen (neu):**
- `Communication Agent` — Inbox + Send
- `Marketing` — Segmente, Kampagnen, Vorlagen, Dashboard-Read
- Admin/Super Admin — volle Verwaltung

---

## Vorgehen & Freigabe

Ich empfehle **Phase 1 zuerst umzusetzen** (Foundation + Inbox + Kontakt-Panel), damit die Basis produktiv nutzbar ist. Danach iterativ Phase 2–5. Phase 6 nur nach expliziter Freigabe.

**Bitte bestätige:**
1. Freigabe für **Phase 1** — dann starte ich sofort mit Migration + UI.
2. Oder soll ich **alle Phasen 1–5 sequenziell** durchziehen (mehrere große Migrationen + viele Edge Functions)?
3. Twilio-Connector: soll ich Meta (Facebook/Instagram) auch in Phase 3 einbauen, oder erst nachdem du Meta-App bereitgestellt hast?
