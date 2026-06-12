---
name: Sales Leads / Zoho Forms Anfragen
description: Vertriebsanfragen aus Zoho Forms in SALES MANAGEMENT mit Angebot-Handoff und Nachfassen
type: feature
---
- Menü: SALES MANAGEMENT → "Anfragen" (`/verkauf/anfragen`, Detail `/verkauf/anfragen/:id`) und "Nachfassen" (`/verkauf/nachfassen`).
- Tabellen: `sales_leads`, `sales_lead_history` (Auto-Trigger bei Status), `sales_followups`, `integration_logs`.
- Rollen mit Zugriff: Super Admin, Admin, Vertrieb, Vertriebsleitung, Order, SACHBEARBEITUNG. Delete: nur Super Admin.
- Inbound-Webhook: Edge Function `zoho-forms-import`, Auth via Header `x-api-key` (Secret `ZOHO_FORMS_WEBHOOK_KEY`), Upsert auf `(source, external_id)`, In-App-Notification an Vertriebs-Rollen via `mail_notifications`.
- Duplikatsprüfung Kunden: email → phone → company_name auf `public.customers`.
- Angebot-Handoff: Detail-Seite schreibt `sessionStorage.sales_lead_handoff_v1` und navigiert zu `/verkauf/angebot/neu`; `AngebotErstellen` liest den Schlüssel und prefilled Kunde + Notizen.
