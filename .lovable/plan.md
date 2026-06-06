# Service-Automatisierung – Plan

Ziel: Tickets, Reparaturen, Bestellungen, Finance und Tourenplanung automatisch verknüpfen. **Nur ergänzen, keine bestehende Logik verändern.**

## 1. Datenbank-Migration (additiv)

Neue Felder & Tabellen, alle bestehenden Spalten bleiben unverändert:

- `tickets`: + `auto_category` (text), `auto_priority` (text), `suggested_technician_id` (uuid), `sla_status` (text: ok/warn/breach), `sla_last_check` (timestamptz), `classified_at` (timestamptz)
- Neue Tabelle `ticket_category_rules` (Keyword→Kategorie, seedbar, editierbar durch Admin)
- Neue Tabelle `technician_skills` (user_id, category) – für Techniker-Vorschlag
- Neue Tabelle `device_files` (Geräteakte-Cache; optional – wir können auch live aggregieren). Entscheidung: **live aggregieren** über Views/Queries, keine neue Tabelle nötig.
- Neue Tabelle `service_communication_log` (ticket_id, type, sent_at, recipient) – für die automatischen Mails

RLS: alle neuen Felder/Tabellen folgen bestehender `can_access_tickets()` / `is_admin()` Logik. Delete nur Super Admin.

## 2. Auto-Klassifizierung & Priorität

- DB-Trigger `classify_ticket_on_insert` auf `tickets`:
  - Setzt `auto_category` durch Keyword-Match (aus `ticket_category_rules`)
  - Setzt `auto_priority='Hoch'` bei Schlüsselwörtern: Totalausfall, startet nicht, Brandgeruch, Überspannung, Wasserschaden
  - Setzt `suggested_technician_id` aus `technician_skills` (erster passender aktiver Techniker)
- Seed-Daten für die 12 Kategorien mit deutschen Keywords.

## 3. SLA-System

- Edge Function `ticket-sla-check` (Cronjob, stündlich via pg_cron):
  - 24h unbeantwortet → `sla_status='warn_response'`
  - 72h unbearbeitet → `sla_status='warn_progress'`
  - 7 Tage offen → `sla_status='breach'`
  - Schreibt Notification in `mail_internal_messages` an zugewiesene Techniker + Serviceleitung.
- Anzeige als Badge im Ticket.

## 4. Kundenkommunikation

- Edge Function `ticket-customer-notify` mit Events:
  - `ticket_received` (Trigger nach Insert)
  - `ticket_in_progress` (Status→in Bearbeitung)
  - `spare_part_ordered` (repair_spare_parts status→bestellt)
  - `repair_completed` (repair_status→Reparatur abgeschlossen)
  - `shipment_sent` (repair_status→Ausgeliefert)
- Nutzt bestehendes Resend-Setup; loggt in `service_communication_log`.
- Frontend-Toggle pro Ticket "Kunde automatisch benachrichtigen".

## 5. Geräteakte (neue Seite)

Route `/geraeteakte` (lazy):
- Suchfeld: Seriennummer / Kunde / Auftrag / Gerät
- Ergebnisliste → Detailansicht mit Tabs:
  - Tickets (aus `tickets` wo `device_serial`)
  - Reparaturen (aus `repair_orders`)
  - Ersatzteile (`repair_spare_parts`)
  - Rechnungen (`repair_invoice_proposals` + ggf. `orders`)
  - Wartungen (Repairs mit Kategorie=Wartung)
- **Service-Ampel** oben: grün/gelb/rot anhand offener Vorgänge.
- Zugriff: Admin, Super Admin, Technik, Kundenservice, Serviceleitung.

## 6. Dashboard-Erweiterung (Service Cockpit)

Bestehendes `ServiceCockpit.tsx` **ergänzen** (nicht ersetzen) um:
- Top Fehler (bereits da → behalten)
- Top Geräte, Top Techniker, Top Kunden (neue Bar-Charts)
- Garantiequote (Tickets mit Kategorie „Garantie" / total)
- Ø Reparaturdauer (aus `repair_orders.created_at` → Status=Ausgeliefert)

## 7. Navigation

`AppLayout.tsx`: Eintrag „Geräteakte" unter Reparaturannahme. Service Cockpit bleibt.

## Technisches Detail

- Migration: 1 Datei mit allen neuen Tabellen, Spalten, Triggern, Seeds, RLS + GRANTs.
- Edge Functions: `ticket-sla-check`, `ticket-customer-notify`. Beide mit CORS + Resend.
- Cronjob via `pg_cron` für SLA stündlich.
- Frontend: neue Komponenten `GeraeteAkte.tsx`, `ServiceAmpel.tsx`, kleine Erweiterungen in `TicketDetail.tsx` (Badges), `ServiceCockpit.tsx` (neue Charts).

Bestehende Funktionen werden nicht verändert – nur additive Trigger, Spalten, Routen, Charts.

OK, dann implementiere ich in dieser Reihenfolge?
