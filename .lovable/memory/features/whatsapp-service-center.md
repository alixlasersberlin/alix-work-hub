---
name: WhatsApp Service Center
description: Inbound-WhatsApp-Nachrichten erzeugen/verlinken Tickets, Antworten via Cloud API. Tabellen whatsapp_sc_*, edge functions whatsapp-webhook + whatsapp-send.
type: feature
---
- Modul-Route: `/whatsapp`, sichtbar für Admin, Super Admin, Kundenservice, Technik, Finance, Tourenplanung.
- Tabellen (additiv, nicht mit Automation-Tabellen `whatsapp_messages`/`whatsapp_templates` verwechseln):
  - `whatsapp_sc_conversations` (pro Telefonnummer, linked_customer_id, linked_ticket_id, assigned_department, opt_out)
  - `whatsapp_sc_messages` (direction in/out, media_url, whatsapp_message_id unique)
  - `whatsapp_sync_logs` (Audit)
  - `whatsapp_sc_templates` (7 Standardantworten geseedet, `key` unique)
- Edge Functions:
  - `whatsapp-webhook` (verify_jwt=false, HMAC-Signaturprüfung via WHATSAPP_APP_SECRET, GET-Verify via WHATSAPP_VERIFY_TOKEN). Mappt eingehende Nachrichten auf Kunde (phone match) + offenes Ticket; erzeugt sonst Ticket mit `source_system='whatsapp'`, spiegelt Nachrichten nach `ticket_messages` (öffentlich).
  - `whatsapp-send` (verify_jwt=true). Nur Super Admin/Admin/Kundenservice. Prüft Opt-out. Sendet via Cloud API (`/messages`). Niemals interne Notizen senden.
- Secrets: WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_APP_SECRET, WHATSAPP_VERIFY_TOKEN.
- Webhook-URL für Meta: `https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/whatsapp-webhook`.
- DELETE nur Super Admin (globale Regel).
