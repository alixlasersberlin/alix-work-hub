# Enterprise Scheduling Center (ESC) – Prompt 1: Grundmodul & Architektur

Du hast angekündigt, dass **Prompt 2** die vollständige Datenbankstruktur bringt. Deshalb baue ich in Prompt 1 **nur das Frontend-Gerüst + Routing + Design-Integration**, mit lokalen TypeScript-Mock-Daten. Alle Komponenten sind so gekapselt, dass in Prompt 2 nur der Daten-Layer (Hooks/API) gegen Supabase-Tabellen ausgetauscht wird — kein UI-Umbau nötig.

## 1. Nicht-Ziele (bewusst nicht in Prompt 1)
- Keine neuen Supabase-Tabellen (kommt in Prompt 2)
- Keine echte E-Mail-Versendung (Stub-UI vorhanden)
- Keine echte Token-Auflösung serverseitig (öffentliche Seite existiert, Auflösung Prompt 2)
- Kein echtes Audit-Log-Schreiben (UI + Interface vorbereitet)

## 2. Navigation
Neuer Hauptmenüpunkt **„Teamkalender"** in AuroraTopNav / Sidebar (nur eingeloggt sichtbar) mit 8 Unterpunkten:
Übersicht · Kalender · Ressourcen · Mitarbeiter · Abteilungen · Buchungsportal · Bestätigungen · Einstellungen.

Bestehende Menüpunkte bleiben unverändert.

## 3. Routen
Interne Routen (auth-geschützt via bestehendem RequireAuth):
```
/esc                        → Übersicht (Dashboard-Cards)
/esc/kalender               → Kalender (Tag/Woche/Monat/Agenda/Abteilung/Mitarbeiter/Ressource)
/esc/ressourcen             → Ressourcen-Verwaltung
/esc/mitarbeiter            → Mitarbeiter-Zuordnung
/esc/abteilungen            → Abteilungen-Verwaltung
/esc/buchungen              → interne Buchungsanfragen
/esc/bestaetigungen         → offene externe Bestätigungen
/esc/einstellungen          → Modul-Settings
```

Öffentliche Routen (kein Login, laufen über `https://alixworks.de/...`):
```
/book                       → öffentliches Buchungsportal
/termin-bestaetigen/:token  → Bestätigen / Ablehnen / Alternativvorschlag
```

## 4. Neue Dateien
```
src/pages/ESC/
  Overview.tsx              KPI-Cards (heute, morgen, offen, überfällig, Service, Lieferung, Schulung, NiSV)
  Calendar.tsx              Kalender-Container + Ansichtsumschalter
  Resources.tsx
  Employees.tsx
  Departments.tsx           inkl. „Neue Abteilung"-Modal
  Bookings.tsx              interne Buchungsanfragen
  Confirmations.tsx         offene externe Bestätigungen
  Settings.tsx

src/pages/ESC/public/
  BookingPortal.tsx         /book – nur öffentlich buchbare Abteilungen
  ConfirmAppointment.tsx    /termin-bestaetigen/:token

src/components/esc/
  EscLayout.tsx             Sub-Nav für alle /esc/*-Seiten (Aurora-Style)
  AppointmentModal.tsx      Termin anlegen/bearbeiten (alle Felder aus §8)
  AppointmentCard.tsx       Termin-Chip im Kalender
  StatusBadge.tsx           farbige Badges für 9 Status (§9)
  DepartmentBadge.tsx       Farbe + Icon
  ViewSwitcher.tsx          Tag/Woche/Monat/Agenda/Abteilung/Mitarbeiter/Ressource
  views/DayView.tsx
  views/WeekView.tsx
  views/MonthView.tsx
  views/AgendaView.tsx
  views/DepartmentView.tsx
  views/EmployeeView.tsx
  views/ResourceView.tsx

src/lib/esc/
  types.ts                  Department, Employee, Resource, Appointment, Status, Priority …
  mock-data.ts              Seed für Prompt 1 (wird in Prompt 2 durch Supabase-Hooks ersetzt)
  ics.ts                    ICS-Datei-Generator (RFC 5545, VEVENT, ORGANIZER, ATTENDEE, ALARM)
  permissions.ts            Rechte-Helper (nutzt bestehendes has_role)
  audit.ts                  Interface für spätere Audit-Log-Einträge (no-op Stub)
  public-url.ts             baseUrl-Helper – erzwingt https://alixworks.de für alle Public-Links

src/hooks/esc/
  useAppointments.ts        vorerst Mock, in Prompt 2 gegen Supabase
  useDepartments.ts
  useEmployees.ts
  useResources.ts
```

## 5. Design-Integration
- Wiederverwendung: `PageShell`, `PageHeader`, `KpiTile`, `InfinityTable`, `StatusBadge`, `Skeleton`, bestehende Buttons/Cards/Modals aus `src/components/ui` und `src/components/infinity`.
- Keine neuen Farben — alle Status/Abteilungsfarben werden aus semantischen Tokens gemappt (primary, secondary, muted, destructive, warning, success).
- Sub-Navigation im gleichen Aurora-Stil wie Finance/Operation.
- Icons aus lucide-react (bereits im Projekt).

## 6. Rollen & Rechte (nutzt bestehendes RBAC)
Neue Rechte werden über eine `escPermissions`-Helperklasse aus bestehenden Rollen abgeleitet — **keine neue Rolle** in Prompt 1:
- Super Admin, Admin: alles
- Order/Service/Sales: eigene Termine + zugewiesene sehen
- alle Übrigen: nur eigene Termine

In Prompt 2 kann optional eine feinere Rechtematrix in DB kommen.

## 7. Öffentliche Links & Sicherheit
- `publicUrl(path)`-Helper baut immer `https://alixworks.de` als Basis (nie Preview-Domain, nie Supabase-URL).
- Bestätigungs-Token: In Prompt 1 Platzhalter (`crypto.randomUUID()` clientseitig), in Prompt 2 wird serverseitig ein signiertes Token generiert (kryptographisch sicher, 32 Byte, base64url).
- Öffentliche Bestätigungsseite akzeptiert nur Token-Route, keine ID-Route.

## 8. ICS-Export
`src/lib/esc/ics.ts` generiert Standard-konforme VEVENTs mit UID, DTSTART, DTEND, SUMMARY, DESCRIPTION, LOCATION, ORGANIZER, ATTENDEE, VALARM. Kompatibel mit Apple/iOS, Google, Outlook, Microsoft 365, Exchange, Thunderbird, Samsung, CalDAV (Import).

## 9. Kalender-Umsetzung
- Eigene, leichtgewichtige React-Views (kein FullCalendar-Import) — passt sich exakt in Aurora-Look ein und bleibt frei von Fremd-CSS.
- Datumsarithmetik über bereits installiertes `date-fns`.
- Drag-to-create in Tag/Woche folgt in einer späteren Iteration; Prompt 1 nutzt Modal-Trigger per Klick auf leere Slot-Zelle.

## 10. Abnahme (Prompt 1)
- Menüpunkt „Teamkalender" mit 8 Unterpunkten sichtbar
- Alle 8 internen Seiten routen fehlerfrei
- Öffentliche Seiten `/book` und `/termin-bestaetigen/:token` erreichbar mit AlixWorks-Branding, ohne Login
- Termin-Modal mit allen Feldern aus §8, Status-Badges §9
- Kalender-Ansichten Tag/Woche/Monat/Agenda/Abteilung/Mitarbeiter/Ressource umschaltbar
- Abteilungen anlegen/bearbeiten (Farbe, Icon, öffentlich buchbar, Standarddauer, Vorlage)
- Mitarbeiter zuordnen (mehrere Abteilungen möglich)
- ICS-Download-Button pro Termin erzeugt gültige `.ics`
- Alle Public-Links verwenden `https://alixworks.de` (Helper testbar)
- Keine bestehenden Seiten/Routen/Migrationen verändert

## 11. Was Prompt 2 dann liefert
- Tabellen: `esc_departments`, `esc_employees`, `esc_resources`, `esc_appointments`, `esc_confirmations`, `esc_audit_log`, `esc_public_tokens`
- RLS-Policies + GRANTs
- Edge Function `esc-send-confirmation-email` (mit signierten Token)
- Edge Function `esc-confirm-appointment` (Token-Auflösung + Statuswechsel)
- Umschalten aller Hooks von Mock auf Supabase (keine UI-Änderung)

---

**Bestätige diesen Plan, dann baue ich das komplette Prompt-1-Gerüst in einem Zug.**
