---
name: Customer SMS Versand
description: SMS-Versand von PDF-Dokumenten an Kunden via Twilio, signierte Links über /d/:token, Tab in Kundenakte
type: feature
---
- Neuer Tab „SMS Versand" in `/kunden/:id` (Komponente `src/components/CustomerSmsTab.tsx`).
- Zeigt alle `order_documents` aller Aufträge des Kunden + Versandhistorie (`customer_sms_logs`).
- Edge Function `send-customer-sms` (verify_jwt = true): nutzt Twilio Programmable SMS via TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN, Absender TWILIO_SMS_FROM_NUMBER (Fallback: TWILIO_WHATSAPP_FROM_NUMBER ohne whatsapp:-Präfix).
- Erzeugt/wiederverwendet `order_documents.download_token` und baut Link `${origin}/d/${token}` (Route über bestehende od-download Function).
- Rollen: Super Admin, Admin, Vertrieb, Kundenservice, Finance, Service, Serviceleitung, Reparaturannahme, Technik (Helper `can_send_customer_sms()`).
- Tabelle `customer_sms_logs` mit RLS, INSERT nur über Function (sent_by = auth.uid()).
