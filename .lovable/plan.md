# Ticket-Kommunikationsarchitektur AlixWork

Ziel: Ticket = zentrale Kommunikation, Kalender nur Termine/Fristen, klare Trennung Kunde/intern, ein verantwortlicher Mitarbeiter, saubere Kanäle.

## Aktueller Bestand
- `tickets`, `ticket_messages` (`is_internal`), `ticket_history`, `ticket_attachments`, `ticket_departments`, `ticket_category_rules` vorhanden
- Kundenportal `/kunde/tickets` und öffentliches `/portal` inkl. Ticketerstellung
- `TicketDetail` mit Tabs, Auto-Routing (`ticket-router`), AlixSmart-Sync, Kalender-Sync
- Mail-Versand via `send-mail` (seit letzter Änderung ausgehende Antworten an Kunden)

## Phasen

### Phase 1 – Anliegen-basierte Ticketerstellung + Auto-Routing (Kunde)
- Neuer Wizard in `/kunde/tickets` und `/portal` mit fester Anliegen-Liste (10 Punkte aus Doc)
- Statt „Abteilung + Mitarbeiter wählen" → nur Anliegen wählen; Auto-Mapping via `ticket_category_rules` bzw. neuer `anliegen → department`-Map
- Portal-View zeigt: Ticket-Nr, Status, Abteilung, Ansprechpartner (falls zugewiesen), Verlauf, Anhänge, Termine – keine internen Details
- Betreff/Beschreibung + Datei-Uploads (Bilder/Videos/Dokumente)

### Phase 2 – Strikte Trennung Kunde/intern + Absender-Identität
- `TicketDetail`: zwei getrennte Buttons „An Kunden senden" (grün) und „Interne Notiz" (grau) mit deutlich unterschiedlicher UI
- Vor Assign: Antworten als Abteilungsname („Alix Lasers Service")
- Nach Assign: Antworten als Mitarbeiter mit Name/Abteilung/Funktion (aus `user_profiles`)
- Kundenportal zeigt für Absender nur: Name, Abteilung, Funktion, optional Avatar – nie private Mail/Tel
- E-Mails an Kunde nutzen von-Adresse pro Abteilung, Reply-To zeigt auf Ticket-Mailbox

### Phase 3 – Ein Verantwortlicher + Teilnehmer + Übergabe/Hinzuziehen
- Neue Tabelle `ticket_participants` (ticket_id, user_id, role: responsible|collaborator|observer|department_lead|escalation)
- `tickets.assigned_to` bleibt Hauptverantwortlicher; Migration setzt bestehende Zuweisungen
- Zwei separate Aktionen in TicketDetail:
  - „Abteilung hinzuziehen" → fügt Mitbearbeiter hinzu, Verantwortung bleibt
  - „Ticket übergeben" → Pflichtformular (Grund, Sachstand, nächster Schritt, Frist, Kunde informiert Ja/Nein) → wechselt `assigned_to`+`department`, schreibt in `ticket_history`
- @-Mention in interner Notiz löst In-App-Benachrichtigung aus (neue Tabelle `notifications`, WS via Supabase Realtime)

### Phase 4 – Kommunikationsstatus + Reaktionsfristen
- Neue Spalte `tickets.comm_status` (enum: none|awaiting_customer|awaiting_agent|awaiting_internal|awaiting_appointment_confirm|customer_unreachable|customer_replied|closed)
- Trigger: Kundenantwort → `awaiting_agent`; Agent-Antwort → `awaiting_customer`; Termin vorgeschlagen → `awaiting_appointment_confirm`
- Reaktionsfristen pro Abteilung (`ticket_departments.sla_hours`); überfällige Tickets in Dashboard-Widget + Eskalation an Abteilungsleiter (nutzt vorhandene `ticket-escalation-engine`)
- Auto-Erinnerung an Kunde nach X Tagen ohne Antwort (2× dann „Warten auf Kunde")

### Phase 5 – Kanal-Integration mit Ticket-Bezug
- Telefonat dokumentieren: Button „Anruf dokumentieren" → Modal (Datum/Zeit, Gesprächspartner, Ergebnis, Zusage, nächster Schritt, neue Frist) → speichert als `ticket_messages` (sender_type=phone_note, is_internal=false wenn zusammengefasst)
- Ausgehende E-Mail: nur Benachrichtigung mit Ticket-Link, kein sensibler Inhalt (Opt-in pro Abteilung)
- Inbound-E-Mail: bestehende `inbound-mail`-Function um Ticket-Zuordnung via `AW-YYYYMMDD-XXXX`-Muster im Betreff/Reply-To erweitern; unbekannte Antworten → neues Ticket
- SMS/WhatsApp bleiben vorerst für Termin-Trigger, keine Freitext-Konversation

### Phase 6 – Kalender & Aktionsleiste
- Kalender-Events nur aus expliziten Aktionen: Rückruf, Videotermin, Vor-Ort, Reparatur, Lieferung, Aufbau, Schulung, NiSV, Wiedervorlage, Frist, Eskalation
- Kalender-Event verlinkt zurück ins Ticket („Ticket öffnen")
- TicketDetail-Kopf reduziert auf 9 Hauptaktionen aus Doc §14
- Kunde bekommt E-Mail nur bei relevantem Wechsel (Ansprechpartner/Bearbeitungszeit), nicht bei jeder internen Übergabe

## Technische Details
- Neue Tabellen: `ticket_participants`, `ticket_notifications`
- Neue Spalten: `tickets.comm_status`, `ticket_departments.sla_hours`, `ticket_departments.reply_display_name`, `user_profiles.public_title`, `user_profiles.public_avatar_url`
- RLS: Kunde sieht nur `is_internal=false` Nachrichten seines Tickets (bereits Grundlage vorhanden, prüfen)
- Realtime für `ticket_messages` und `ticket_notifications`
- Enum `ticket_comm_status` als PG-Enum
- Alle Migrationen mit GRANTs

## Diagramme
```text
Kunde                                    AlixWork
  |                                         |
  | Anliegen wählen ---------------------->  Ticket (Auto-Routing → Abteilung)
  |                                         |
  |   Portal-Verlauf   <----- Nachricht ----+ Agent/Abteilung antwortet
  |   E-Mail Benachr.  <-------------------+
  |                                         |
  | Nachricht/Anhang -----------------------> ticket_messages (sender=customer)
  |                                         | @Mention → Notification
  |                                         | Übergabe → Pflichtnotiz + history
  |                                         |
  |   Termin-Vorschlag <-------------------- Kalender-Event (verlinkt zu Ticket)
  | Bestätigen/Ablehnen -------------------->
```

## Umfang & Reihenfolge
Empfohlen: **Phase 2 zuerst** (schnellster Sichtbarkeits-Gewinn, kleinste Änderung), dann **Phase 3**, **4**, **1**, **5**, **6**.

Sag mir welche Phase(n) und in welcher Reihenfolge – dann setze ich sie um.