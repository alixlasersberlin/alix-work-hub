## Angebotskalender & Follow-Up Center 360°

Neues Modul unter **Sales Management → Angebotskalender** (`/verkauf/angebotskalender`). Es verändert keine bestehende Seite, Tabelle, Rolle oder Funktion — es ergänzt nur.

### 1. Datenbank (additiv, neue Tabellen)

Es wird NICHTS an `offers`, `sales_followups`, `customers`, `user_roles`, `app_settings` etc. geändert. Neu:

- `offer_followup_tasks` — eine Aufgabe je Stufe & Angebot
  - `id, offer_number, customer_id, owner_user_id, stage (1..5), due_at, status (offen|erledigt|übersprungen|inaktiv), priority (gruen|gelb|orange|rot), title, channel_done (email|sms|call|note|null), done_at, created_at`
- `offer_contact_log` — alle manuellen Kontakte aus dem Kalender (E-Mail, SMS, Call, Notiz)
  - `id, offer_number, customer_id, user_id, channel, subject, body, created_at`
- `offer_outcomes` — Gewonnen/Verloren-Status für Erfolgsquote (Angebote bleiben unverändert)
  - `offer_number PK, outcome (gewonnen|verloren|offen|inaktiv), reason, decided_at, decided_by`
- `offer_followup_settings` — Mandanten-/Globalconfig
  - Stufen-Tage (Default 2/4/7/14/21), Toggles für Kunden-E-Mail (Tag 4), Kunden-SMS (Tag 7), Eskalations-Schwelle (10.000 €, 14 Tage), Empfänger-IDs

Alle Tabellen erhalten GRANTs + RLS (Ersteller/Owner + Super Admin + Vertriebsleitung).

### 2. Automatik (Edge Functions + Cron)

- `offer-followup-engine` (Cron stündlich): legt fehlende Stufen-Aufgaben an, setzt Prioritätsfarbe, markiert Stufe-5-Angebote als „inaktiv", triggert Eskalationsmail (> 10.000 € & > 14 Tage offen).
- `offer-followup-daily-digest` (Cron täglich 08:00): E-Mail-Zusammenfassung je Mitarbeiter + optionale Kunden-E-Mail/SMS-Reminder. Nutzt vorhandene `send-transactional-email` + Twilio-Gateway.
- `offer-followup-reminders` (Cron stündlich): einzelne Stufen-Mails (Tag 2/4/7/14) an Owner, Twilio-SMS auf Wunsch.
- KI-Priorisierung: bestehende Copilot-Pipeline wird per neuer Funktion `offer-followup-ai-score` aufgerufen (Hot/Warm/Normal/Kalt/Inaktiv-Sterne) und im Task gecached.

Keine bestehenden Funktionen werden angefasst — alle neuen Functions liegen separat.

### 3. UI (nur neue Seiten/Komponenten)

Neuer Sidebar-Eintrag unter Sales Management:
- `src/pages/Sales/AngebotsKalender.tsx`
  - Kopfzeile: KPI-Tiles (Heute fällig, Überfällig, Diese Woche, Monat, Erfolgsquote %)
  - Tabs: **Kalenderansicht** (Monats-/Wochengrid) · **Liste** (Heute, Überfällig, Woche, Inaktiv) · **Cockpit**
  - Filter: Mitarbeiter, Priorität (Ampel), Sterne (KI), Wertbereich
- `src/pages/Sales/AngebotsCockpit.tsx` (innerhalb Tab) — Umsatz offen, gewonnen, verloren, Quote je Mitarbeiter
- Komponenten unter `src/components/sales/followup/`:
  - `FollowupCalendar.tsx`, `FollowupTaskCard.tsx` (mit Buttons E-Mail/SMS/Anruf/Notiz/Angebot/Kunde), `FollowupKpiBar.tsx`, `PriorityDot.tsx`, `AiStars.tsx`, `OutcomeDialog.tsx`, `ContactLogDialog.tsx`
- Login-Popup: `SalesFollowupLoginDialog.tsx` — wird nach Auth einmal pro Tag gezeigt, wenn offene/überfällige Aufgaben vorhanden sind; Button „Jetzt bearbeiten" → Kalender.

### 4. Erinnerungslogik (Stufen)

| Stufe | Tage seit Angebot | Titel |
|---|---|---|
| 1 | +2 | Kunde kontaktieren |
| 2 | +4 | Nachfassen (+ optional Kunden-Mail) |
| 3 | +7 | Dringende Kontaktaufnahme (+ optional Kunden-SMS) |
| 4 | +14 | Letzte Angebotsnachverfolgung |
| 5 | +21 | Angebot als „Inaktiv" markieren |

Ampel: grün <2 Tage zu Fälligkeit, gelb 0–1 Tag, orange Stufe 3, rot überfällig.

### 5. Kanäle aus dem Kalender

Pro Karte: 📧 E-Mail (öffnet vorhandenes Mail-Modul mit Vorlage), 📱 SMS (Twilio-Gateway), 📞 Anruf dokumentieren, 📝 Notiz, 📄 Angebot öffnen (`/verkauf/angebot/neu?edit=…`), 👤 Kundenakte (`/kunden/…`). Jede Aktion schreibt `offer_contact_log` und markiert die aktuelle Stufe als erledigt.

### 6. Eskalation

`offer-followup-engine` prüft `offers.totals.gross > 10000` UND offen > 14 Tage → sendet Mail an Rollen **Vertriebsleitung**, **Head of Operations**, **Geschäftsführung** (per `user_roles`-Lookup), markiert Task als „eskaliert".

### 7. Design / Scope-Grenze

Aurora/Infinity-Design wie bestehende Sales-Seiten (`PageHeader`, `KpiTile`, `InfinityTable`, `StatusBadge`). Vollständig responsive.

Strikt nicht angefasst: bestehende `offers`-Tabelle, `Angebote.tsx`, `Freigabe.tsx`, `sales_followups`-Modul, Routen, Rollen, Mail-/SMS-Templates der anderen Module.

### Lieferreihenfolge

1. Migration (4 neue Tabellen + GRANTs + RLS + cron jobs)
2. Edge Functions (engine, daily-digest, reminders, ai-score)
3. Sidebar-Link + Route
4. Kalender-Seite + Komponenten
5. Cockpit-Tab
6. Login-Popup
7. Optional: Kunden-Mail/SMS-Templates registrieren
