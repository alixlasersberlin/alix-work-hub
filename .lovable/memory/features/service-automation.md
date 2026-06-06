---
name: Service-Automatisierung
description: Auto-Klassifizierung, SLA, Geräteakte, Service-Ampel, Top-KPIs für Service Cockpit
type: feature
---
Erweitert Tickets/Reparaturen ohne bestehende Logik zu verändern.

- `tickets` Spalten: `auto_category`, `auto_priority`, `suggested_technician_id`, `sla_status` (ok|warn_response|warn_progress|breach), `sla_last_check`, `classified_at`, `auto_notify_customer`.
- Trigger `trg_classify_ticket` (BEFORE INSERT) ruft `classify_ticket()` – nutzt `ticket_category_rules` + High-Priority-Keywords (totalausfall, startet nicht, brandgeruch, überspannung, wasserschaden) + `technician_skills` für Vorschlag.
- Tabellen: `ticket_category_rules` (seedbar, Admin-Write), `technician_skills`, `service_communication_log`.
- Edge Functions: `ticket-sla-check` (cron-fähig), `ticket-customer-notify` (Events: ticket_received, ticket_in_progress, spare_part_ordered, repair_completed, shipment_sent → Resend).
- Neue Seite `/geraeteakte`: Suche nach Seriennummer/Kunde/Auftrag/Gerät, Tabs (Tickets, Reparaturen, Ersatzteile, Rechnungen, Wartungen), Service-Ampel (grün=0 offen, gelb=offenes Ticket, rot=≥2 offene Reparaturen).
- Service Cockpit erweitert: Garantiequote, Ø Reparaturdauer (Tage), Top Kunden Chart, Excel-Sheet „Kunden".
- Zugriff Geräteakte: Admin, Super Admin, Technik, Kundenservice, Serviceleitung.
