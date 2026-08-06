# Tourenplanung → ALIX DISPATCH CENTER

Ausbau der vorhandenen Tourenplanung (`route_plans`, `/tourenplanung`) zu einem vollständigen Dispatch-System: Lieferterminplanung, Kundenbestätigung, Tourenoptimierung, Fahrer-/Fahrzeugverwaltung, mobile Auslieferung und Archiv.

Der Umfang entspricht ca. 25 neuen Tabellen, 8 Edge Functions und ~30 Seiten. Das wird in 6 Phasen gebaut, jede Phase ist für sich lauffähig.

## Bestand, auf dem aufgebaut wird

- `route_plans` (39 Spalten) — bleibt als Einsatz-/Termin-Basis erhalten, wird nicht dupliziert
- `dispatch_vehicles`, `dispatch_checklists`, `dispatch_signatures`, `dispatch_attachments` — werden erweitert statt ersetzt
- `esc_events` (Teamkalender / Enterprise Scheduling Center) — Ziel der Kalender-Synchronisation
- `orders`, `customers`, `inventory`/Seriennummern, `alixdocs2_documents`, `user_profiles`, `user_roles`
- Mobile PWA `/m` und `useDrivingTimes` (Routing) sind vorhanden und werden weiterverwendet

## Phase 1 — Datenmodell & Workspace-Gerüst

Neue Tabellen (alle mit RLS, GRANTs, `created_at/updated_at`, Audit-Trigger):

`delivery_tours`, `delivery_tour_stops`, `delivery_appointments`, `delivery_status_history`,
`delivery_confirmations`, `delivery_confirmation_tokens`, `delivery_email_logs`, `delivery_notifications`,
`delivery_loading_lists`, `delivery_loading_items`, `delivery_checklists`, `delivery_documents`,
`delivery_photos`, `delivery_signatures`, `delivery_incidents`, `delivery_costs`,
`vehicles` (Ausbau von `dispatch_vehicles`), `vehicle_availability`, `vehicle_maintenance`,
`drivers`, `driver_qualifications`, `driver_availability`, `route_calculations`, `mileage_logs`,
`delivery_settings`

Verknüpfung ausschließlich per FK zu `orders`, `customers`, `esc_events`, `alixdocs2_documents`.

Enums: `delivery_status` (22 Werte), `delivery_appointment_type` (13 Werte), `delivery_readiness` (grün/gelb/rot), `vehicle_status`, `loading_item_status`.

Menü: `Operation → Tourenplanung` mit den Unterpunkten Dashboard, Tagesplanung, Wochenplanung, Monatsübersicht, Karte, Ungeplante Auslieferungen, Terminbestätigungen, Fahrer & Fahrzeuge, Archiv, Einstellungen. Routen unter `/tourenplanung/*` und im Workspace `Operation`.

## Phase 2 — Aufträge, Lieferbereitschaft, Terminanlage

- „Ungeplante Auslieferungen": Liste aller lieferbereiten, nicht eingeplanten Aufträge (serverseitig paginiert, gefiltert)
- Lieferbereitschafts-Prüfung als DB-Funktion `check_delivery_readiness(order_id)` → Ampel + Liste der offenen Punkte (Zahlung, Gerät/Seriennummer, Dokumente, Adresse, Kontakt, Sperren, Reklamation)
- Rote Sperre nur von Admin/Super Admin mit Pflichtbegründung übergehbar (protokolliert)
- Dialog „Liefertermin erstellen" aus Auftrag und aus der Tourenplanung, mit allen Pflichtfeldern und den 13 Terminarten
- Statusmodell mit Farbcodierung (grau/gelb/grün/blau/rot/dunkelgrau) plus `delivery_status_history`

## Phase 3 — Kundenbestätigung (E-Mail + öffentliche Seite)

- Edge Function `delivery-appointment-send`: erzeugt Token (Ablaufdatum), versendet personalisierte E-Mail an Kunde, Verkäufer, Fahrer, Operations, protokolliert in `delivery_email_logs`, BCC-Regel wie im übrigen System
- Öffentliche, mobiloptimierte Seite `/liefertermin/:token` (kein Login): bestätigen, Alternativtermin, ablehnen, Rückruf, Kontakt-/Adresskorrektur, Bemerkung
- Edge Function `delivery-confirmation-submit`: Statuswechsel, Protokoll (Zeit, IP, User-Agent), PDF-Erzeugung, Ablage in AlixDocs bei Kunde + Auftrag, Benachrichtigung aller Beteiligten
- Teamkalender-Sync: bei Anlage gelber Eintrag „Kundenbestätigung ausstehend / vorläufig", nach Bestätigung grün „Vom Kunden bestätigt"; Eintrag enthält Kunde, Auftragsnr., Adresse, Zeitfenster, Fahrer, Fahrzeug, Gerät, Telefon, Links
- Erinnerungs-Cron `delivery-reminder-engine` (24h/48h/72h Eskalation, Fristen in den Einstellungen, Kanäle E-Mail/SMS)

## Phase 4 — Tourenplanung, Routing, Optimierung

- Tagesplanung mit Timeline, Fahrer-/Fahrzeugspalten, Kennzahlen je Tour (Stopps, km, Fahrzeit, Arbeitszeit, Rückkehr, Auslastung)
- Drei-Spalten-Planungsoberfläche: ungeplante Aufträge · Tages-/Wochenkalender · Karte + Tourdetails
- Drag-and-drop von Auftrag auf Tag/Fahrer/Tour, Reihenfolge per Drag-and-drop
- Edge Function `delivery-route-calc`: Distanzmatrix + Fahrzeiten, Ergebnis-Caching in `route_calculations`; Start-/Endstandorte wählbar
- „Tour optimieren": Reihenfolge nach Zeitfenstern, Priorität, VIP, Arbeitszeit, Fahrzeug/Qualifikation; nach manueller Änderung Neuberechnung
- Filter: Region, PLZ, Woche, Status, Bestätigung, Gerät, Fahrer, Fahrzeug, Verkäufer, Priorität, Zahlung, Land

## Phase 5 — Fahrer, Fahrzeuge, Beladung, Freigabe, Fahreransicht

- Fahrer-/Begleitpersonenverwaltung mit Arbeitszeiten, Abwesenheit, Führerschein, Qualifikationen, Länderfreigaben; Konflikterkennung gegen Teamkalender
- Fahrzeugverwaltung mit Status, HU, Wartung, Zuladung, Reichweite; Warnungen bei Doppelbuchung, Überladung, fälliger Wartung
- Automatische Beladungsliste (umgekehrte Auslieferreihenfolge) mit Item-Status und Vollständigkeitsprüfung
- Freigabe-Checkliste (15 Punkte) — Freigabe nur durch Admin/Super Admin/berechtigte Operations
- Mobile Fahreransicht unter `/m/tour` (nur eigene Touren): Route, Navigation, Anruf, Statusbuttons, Verspätung melden
- Digitale Übergabe: Lieferumfang, Seriennummer, Fotos, Unterschriften Kunde + Mitarbeiter → Lieferschein, Übergabe-/Installations-/Einweisungsprotokoll als PDF automatisch in AlixDocs, Gerät + Auftrag werden aktualisiert
- Fehlgeschlagene Lieferung und Rücknahme/Gerätetausch mit Gründen, Folgeaufgabe, Werkstatt-/Lagerzuordnung

## Phase 6 — Dashboard, Kosten, Archiv, Automatik

- Touren-Dashboard mit den 20 Kennzahlen (heute/Woche, Bestätigungen, km, Auslastung, Pünktlichkeit, Kosten je Tour/Lieferung)
- Kostenerfassung je Tour/Auftrag/Kostenstelle (km-Pauschale, Kraftstoff, Maut, Spesen, Arbeitszeit …)
- Revisionssicheres Tourenarchiv inkl. vollständigem Audit-Log
- Exporte: Tages-/Wochenplan-PDF, Fahrerunterlagen, Beladungsliste, Lieferscheine, km- und Kostenübersicht, Excel/CSV
- Globale Suche um Tour-/Termin-Treffer erweitern
- Intelligente Funktionen: Regionsbündelung, Tourzusammenlegung, Leerfahrt-Warnung, Fahrzeugvorschlag, Arbeitszeitwarnung, automatischer Ratenstart ab bestätigtem Übergabedatum, Hinweis auf lange ungeplante lieferbereite Aufträge

## Technische Hinweise

- Ausschließlich die bestehende Supabase-Instanz; keine Duplikate von Kunden-, Auftrags-, Geräte- oder Dokumenttabellen
- RLS pro Rolle: Super Admin / Admin / Operations / Fahrer (nur eigene Touren) / Verkauf (eigene Kunden, keine Freigabe) / Buchhaltung (Zahlung + Liefersperre, keine Planung)
- Öffentliche Bestätigung nur über Einmal-Token mit Ablauf; keine IDs oder personenbezogenen Daten in der URL; Zugriff ausschließlich über Edge Function mit Service-Rolle
- Serverseitige Pagination, gecachte Routenabfragen, keine unnötigen Realtime-Subscriptions
- Jede Statusänderung in `delivery_status_history` und im zentralen Audit-Log
