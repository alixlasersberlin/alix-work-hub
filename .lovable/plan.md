
## Ziel

Das bestehende Ticketsystem (`public.tickets`) bleibt führend. Der Teamkalender (`esc_events`) zeigt nur ticket-basierte Termine/Fristen und ist bidirektional verknüpft. Umsetzung in zwei Stufen — dieser Plan deckt **Stufe 1** ab (Kern-Routing + Kalender-Bridge + Kundenbestätigung). Stufe 2 (Eskalationsengine, Lastverteilung, Reports) folgt separat.

---

## Stufe 1 — Umfang

### 1. Abteilungen als eigene Tabelle
Neue Tabelle `ticket_departments` (getrennt von `departments`, das für Buchhaltung/Konzern genutzt wird):
- `name`, `slug`, `color` (hex), `is_active`, `sort`, `allow_customer_pick_person` (bool), `routing_strategy` (enum: `manual`, `round_robin`, `region`, `product`, `account_manager`, `least_load`), `mailbox_email`
- Seed mit: Service, Technik, Lieferung, Schulung, NiSV Schulung Virtuell, NiSV Präsenz, Mediapaket, Sales, Buchhaltung, Reklamation, Sonstige
- Super-Admin-CRUD unter `/operation/ticket-abteilungen`

### 2. `tickets` erweitern (bestehende Tabelle, keine Neuanlage)
Neue Spalten:
- `ticket_department_id` (FK → `ticket_departments`)
- `category` (text)
- `due_at` (timestamptz) — Frist
- `appointment_at` (timestamptz) — vereinbarter Kundentermin
- `device_id` (uuid, nullable)
- `order_id` (uuid, nullable)
- `source` bleibt (Wert `kundenportal` / `booking_portal` / `email_inbound` / `manual`)
- `follow_up_at` existiert bereits

Die vorhandenen Felder `department`, `assigned_to`, `priority`, `status` bleiben unverändert und werden weitergenutzt.

### 3. Ticket-Historie
Nutzt bestehende `ticket_messages` + neue Tabelle `ticket_history` (Datum, User, Aktion, alt/neu). Alle Änderungen (Zuweisung, Status, Frist, Termin, Kundenaktion) landen automatisch dort via DB-Trigger.

### 4. Routing-Engine (Edge Function `ticket-router`)
Wird nach jedem `INSERT` in `tickets` (source ≠ manuell) oder manuell per Button aufgerufen. Reihenfolge:
1. Fester Kundenbetreuer (`customers.account_manager_id`, falls vorhanden — sonst übersprungen)
2. Geräte-/Produktzuständigkeit (`technician_skills` bestehend)
3. Region (aus Kundenadresse) — nur wenn `routing_strategy='region'`
4. Least-Load: Mitarbeiter der Abteilung mit den wenigsten `status IN ('Neu','Zugewiesen','In Bearbeitung')` Tickets
5. Fallback: `assigned_to = NULL` → landet im Abteilungs-Postfach

Jede Zuweisung schreibt in `ticket_history`.

### 5. Kunden-Ticketformular (Kundenportal)
Erweiterung `src/pages/CustomerPortal/Tickets.tsx` und `src/pages/ESC/public/BookingPortal.tsx` (Ticket-Zweig):
- Felder: Betreff, Beschreibung, Kategorie, Abteilung (Pflicht), Gerät (aus Kundengeräten), Auftrag (aus Kundenaufträgen), Priorität, gewünschte Rückmeldung, gewünschter Termin (optional), Ansprechpartner (nur wenn Abteilung `allow_customer_pick_person=true`), Anhänge
- Insert via Edge Function `public-book-ticket` (existiert bereits, wird erweitert) → schreibt in `tickets` mit `source='kundenportal'` und ruft `ticket-router` auf

### 6. Kalender-Bridge (`esc_events` ↔ `tickets`)
- Neue Spalte `esc_events.ticket_id` (FK → `tickets`)
- Neue Spalte `esc_events.event_kind` (enum: `rueckruf`, `kundentermin`, `vor_ort`, `reparatur`, `lieferung`, `schulung`, `frist`, `eskalation`, `wiedervorlage`)
- Trigger `sync_ticket_to_calendar`:
  - Wenn `tickets.appointment_at`, `due_at` oder `follow_up_at` gesetzt/geändert wird → passenden `esc_events`-Eintrag erzeugen/aktualisieren
  - Wenn `tickets.assigned_to` oder `department` ändert → Kalendereintrag mitziehen
  - Wenn `tickets.status` auf `Geschlossen`/`Gelöst` → offene Kalendertermine der Zukunft bleiben stehen (User-Sicherheitsabfrage im UI), Fristen/Wiedervorlagen werden `Erledigt`
- Trigger `sync_calendar_to_ticket`:
  - Wenn `esc_events.start_at` verschoben → `tickets.appointment_at` / `due_at` aktualisieren + History-Eintrag
- Ohne einen der drei Zeitfelder entsteht KEIN Kalendereintrag (verhindert Flut)

### 7. Terminstatus getrennt
Neue Spalte `esc_events.appointment_status` (enum: `geplant`, `bestaetigung_ausstehend`, `bestaetigt`, `in_durchfuehrung`, `erledigt`, `abgesagt`, `verschoben`, `nicht_erschienen`) — unabhängig vom Ticketstatus.

### 8. Kundenbestätigung über alixwork.de
Nutzt vorhandenes `/book/confirmation` + neue Routen:
- `/termin/bestaetigen/:token`, `/termin/verschieben/:token`, `/termin/ablehnen/:token`
- Token wird beim Termin-Insert generiert (`esc_events.confirmation_token`, existiert bereits als `confirmationToken`)
- Custom Domain: Links werden mit `https://alixwork.de` gebildet (bereits Custom Domain)
- Edge Function `public-appointment-action` verarbeitet Bestätigung/Verschiebung/Absage → aktualisiert `esc_events.appointment_status` + `tickets.status` + schreibt `ticket_history`, benachrichtigt Mitarbeiter
- Verschiebung: Kunde wählt neuen Slot aus dem Public-Booking-Layout

### 9. Kalenderansicht anpassen
`src/pages/ESC/` (Kalenderseite): 
- Farbe pro Event = `ticket_departments.color` (Fallback bestehende Farbe)
- Filter-Chips: Abteilung, Mitarbeiter, Ticketstatus, Terminstatus, Priorität, Terminart, Standort, Gerät, Auftrag, „Nur meine Termine"
- Klick auf Event → Slideover mit Ticket-Vollansicht + Link zu `/tickets/:id`

### 10. In-App-Benachrichtigungen
Nutzt bestehende `mail_notifications`:
- Bei neuem Ticket: alle Mitglieder der Abteilung + zugewiesener Mitarbeiter
- Bei Zuweisungswechsel: alter + neuer Mitarbeiter
- Bei Kundenbestätigung/-absage: zugewiesener Mitarbeiter

### 11. Dashboard-Kacheln
Neuer Bereich im bestehenden Dashboard (`src/pages/Dashboard.tsx`):
- Neue Tickets, Meine offenen, Heute fällig, Überfällig, Termine heute, Warten auf Kunde, Eskaliert
- Jede Kachel = deeplink zu gefilterter `/tickets`- oder `/esc`-Ansicht

### 12. Berechtigungen (RLS)
- Kunde (customer_portal_users): nur eigene Tickets/Termine (bestehendes Portal-System)
- Mitarbeiter: eigene + Abteilungstickets (via Rolle)
- Abteilungsleiter: neue Rolle `Abteilungsleitung` mit CRUD auf Abteilungstickets, Zuweisung, Frist
- Super Admin: alles

---

## Bewusste Auslassungen (kommen in Stufe 2)

- Automatische Eskalationsengine mit konfigurierbaren Reaktionszeiten pro Abteilung × Priorität
- Push-Benachrichtigungen (aktuell nur In-App + optionale E-Mail via bestehendem Template-System)
- Reports/Analytics zu Ticketauslastung, SLA-Erfüllung
- Round-Robin mit Fairness-Cursor, Region-Routing per Postleitzahl-Range
- Abteilungs-Postfach als eigene Inbox-UI (Stufe 1: `assigned_to IS NULL` + `department_id` Filter reicht)
- Bulk-Migration alter `esc_events`-Ticketanfragen in `tickets` (nur Neuanlagen ab jetzt)

---

## Technische Details

**Reihenfolge der Umsetzung** (jede Migration einzeln, damit Types regeneriert werden bevor Code sie nutzt):

1. Migration A: `ticket_departments` Tabelle + Seed + RLS + GRANTs
2. Migration B: `tickets` neue Spalten + FK zu `ticket_departments` + `ticket_history` + Trigger
3. Migration C: `esc_events.ticket_id`, `event_kind`, `appointment_status`, `confirmation_token` + Sync-Trigger
4. Edge Function `ticket-router` (neu)
5. Edge Function `public-book-ticket` erweitert (Routing-Aufruf, Kategorie/Gerät/Auftrag)
6. Edge Function `public-appointment-action` (neu)
7. Frontend: Kundenportal Ticket-Formular, Kalenderansicht, Slideover, Bestätigungsseiten, Dashboard-Kacheln, Super-Admin CRUD Abteilungen

**Nicht angefasst:**
- Auth/User-Verwaltung
- `mailcenter`, WhatsApp, `alixsmart-tickets-webhook` (bleiben unabhängige Quellen — schreiben weiter direkt in `tickets`)
- Bestehendes `esc_events`-Datenmodell (nur additive Felder)

**Aufwand:** ~3 Migrationen, 3 Edge Functions, ~8 Frontend-Dateien neu/geändert.

Soll ich mit Stufe 1 in dieser Reihenfolge loslegen, oder möchtest du vorher etwas anpassen (z. B. andere Abteilungsliste, Routing-Reihenfolge, oder Terminstatus-Namen)?
