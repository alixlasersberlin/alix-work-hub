## Bestandsaufnahme (vorhanden, wird wiederverwendet)

- `route_plans` – Touren je Auftrag (Datum, Zeitfenster, Mitarbeiter, Team, Fahrzeug, Adresse, Status, Priorität, Notiz). **Pflichtfeld `order_id` ist heute NOT NULL** – muss additiv nullable werden, damit Touren auch aus Ticket/Reparatur/Kunde/Gerät entstehen können.
- `technician_skills` – Skill-Zuordnung User→Kategorie (bleibt unverändert).
- `RoutePlanning.tsx`, `RoutePlanDetail.tsx`, `RoutePlanForm.tsx`, `RoutePlanningSettings.tsx`, `DrivingTimeCell.tsx`, `useDrivingTimes` – bestehende Listen-, Detail-, Formular-, Fahrzeit-Logik (Google Maps / ORS bereits integriert).
- Rollen `Tourenplanung`, `Technik`, `Reparaturannahme`, `Finance`, `Order`, `Admin`, `Super Admin` – alle bereits vorhanden; `can_access_planning()`, `can_manage_planning()` ebenfalls.
- Storage-Bucket `repair-files` – wird für Servicebericht-PDFs mitgenutzt.
- Mail-Infra `notify_customer_event` + Edge Function `ticket-customer-notify` + Resend – wird für neue Tour-Events wiederverwendet.

## Was wirklich fehlt (neu)

1. `route_plans` additiv erweitern (alles `ADD COLUMN IF NOT EXISTS`, keine Drops):
   - `order_id` → nullable
   - `tour_type` text  (Lieferung | Abholung | Rückversand | Vor-Ort-Reparatur | Wartung | Schulung | Gerätetausch | Ersatzteillieferung)
   - `ticket_id`, `repair_order_id`, `customer_id`, `device_serial_number`, `finance_id`
   - `technician_user_id` uuid, `vehicle_id` uuid
   - `contact_name`, `contact_phone`, `contact_email`
   - `device_model`, `requested_date` date
   - `check_in_at`, `check_out_at`, `work_started_at`, `work_ended_at` timestamptz
   - `signature_path`, `report_pdf_path`, `result_outcome`, `next_step` text
   - Status-Wertebereich (kein CHECK, nur Default): `Entwurf|Geplant|Bestätigt|Unterwegs|Vor Ort|Erledigt|Fehlgeschlagen|Verschoben|Storniert` (alte Werte „offen/geplant/…" bleiben gültig).

2. Neue Tabelle `dispatch_vehicles` (Fahrzeugstamm, fehlte bisher).
3. Neue Tabelle `dispatch_attachments` (Foto/Anhänge je Tour, fehlte bisher).
4. Neue Tabelle `dispatch_used_parts` (verwendete Ersatzteile je Einsatz – optional zu `repair_spare_parts`, damit auch Nicht-Reparatur-Touren Teile erfassen können).
5. Neuer Mail-Event-Typ in `ticket-customer-notify`: `tour_scheduled`, `tour_confirmed`, `tour_enroute`, `tour_postponed`, `tour_completed` (Edge Function additiv erweitern, bestehende Events bleiben).
6. Servicebericht-PDF-Generator `src/lib/dispatch/service-report-pdf.ts` (HTML/Print, gleiches Muster wie `report-pdf.ts`).
7. Sidebar/Routes ergänzen unter bestehender Gruppe Tourenplanung:
   - `/tourenplanung/kalender` (Tag/Woche, Drag&Drop, Konfliktwarnung)
   - `/tourenplanung/karte` (Kartenansicht, Route je Techniker, ORS-Reihenfolge)
   - `/tourenplanung/dashboard` (KPIs)
   - Im bestehenden Detail-View: Tabs „Einsatz", „Servicebericht", „Anhänge", „Ersatzteile".
8. Neue, schlanke RLS-Policies für die neuen Tabellen via `can_access_planning()`/`can_manage_planning()` + Super Admin Delete.

## Was NICHT angefasst wird

- Bestehende `route_plans`-Spalten, Trigger, RLS-Policies, bestehende Seiten.
- Tickets-/Orders-/Reparatur-/Finance-Module, Synchronisationen, Edge Functions außer additiver Erweiterung von `ticket-customer-notify`.
- Keine neuen Rollen (alle benötigten existieren bereits).

## Reihenfolge

1. Migration (route_plans additiv, neue Tabellen + GRANTs + RLS).
2. Edge Function `ticket-customer-notify` um Tour-Events erweitern.
3. Frontend:
   - Service-Report-PDF-Generator
   - Kalender-Seite (react-big-calendar oder eigenes Grid mit dnd-kit, Konfliktcheck)
   - Karten-Seite (Google Maps JS API über vorhandenen Browser-Key, ORS für Reihenfolge)
   - Dashboard-KPIs
   - Detail-Tabs Check-in/out, Anhänge (repair-files Bucket), Ersatzteile, Signatur (Canvas), PDF-Erzeugung
   - „Neue Tour aus …" Buttons in Ticket/Reparatur/Kunde/Gerät/Finance
   - Sidebar-Einträge in `AppLayout.tsx` ergänzen.
4. Memory-Update.

## Abschlussbericht (Format am Ende)

- Wiederverwendete Tabellen: route_plans, technician_skills, customers, orders, tickets, repair_orders, repair_spare_parts, lager_devices, finance, user_roles, roles
- Neue Tabellen: dispatch_vehicles, dispatch_attachments, dispatch_used_parts
- Neue Rollen: keine (Wiederverwendung)
- Neue APIs/Edge Functions: ticket-customer-notify (erweitert, additiv)
- Neue Seiten: /tourenplanung/kalender, /tourenplanung/karte, /tourenplanung/dashboard, Detail-Tabs
- Kalender aktiv: ja  ·  Kartenansicht aktiv: ja  ·  Servicebericht aktiv: ja  ·  Kundenmails aktiv: ja
- Produktivstatus: Ja
