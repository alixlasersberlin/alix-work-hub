---
name: ALIXWORK Mobile – WhatsApp Outbound (Prompt 4)
description: Serverseitiger WhatsApp-Versand, Medien über privaten Bucket inbox-media, Quick Replies, Zustellstatus-Webhooks und Ticket-Erstellung aus dem Chat
type: feature
---
- Edge Function `ac-whatsapp-send` ist der einzige Sendeweg: Auth-Pflicht, aktives `user_profiles`-Profil, Feature-Flag `whatsapp_outbound_enabled`, 24-h-Fenster (sonst `TEMPLATE_REQUIRED`), Idempotenz über `client_message_id`, Status queued → sent/failed.
- Provider-Adapter `ac-whatsapp-send/outbound.ts` (META Cloud API + Twilio). Secrets nur serverseitig: WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID bzw. TWILIO_*.
- Zustellstatus (`sent/delivered/read/failed`) kommt über `ac-webhook-whatsapp` (`normalizeStatuses` in provider.ts) und aktualisiert `ac_messages` per `provider_message_id`.
- Medien liegen im **privaten** Bucket `inbox-media` (50 MB); Versand nur über 15-Minuten-Signed-URL, Anzeige über 10-Minuten-Signed-URL.
- Frontend: `src/lib/inbox/api.ts` (`sendWhatsApp`, `uploadInboxMedia`, `fetchQuickReplies`, `createTicketFromChat`, `windowOpen`) und `src/pages/Mobil/InboxChat.tsx` (Quick Replies, Reply-Bezug, Entwurf in localStorage, Ticketdialog).
- Tickets aus dem Chat nutzen die bestehende `tickets`-Tabelle + `tickets_assign_case_number`; Verknüpfung in `conversation_tickets`. Keine eigene Nummernlogik.
- Feature-Flags in `app_settings`: whatsapp_outbound_enabled (default false), media_send_enabled, ticket_from_chat_enabled, voice_messages_enabled (false, NATIVE AUDIO REQUIRED), templates_enabled.
