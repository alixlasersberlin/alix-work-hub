## Ziel
Zoho Forms Anfragen werden im bestehenden **SALES MANAGEMENT** als neuer Unterpunkt **Anfragen** sichtbar, additiv zum vorhandenen Modul. Aus jeder Anfrage entsteht per Klick ein Angebot über das bestehende Angebotsmodul. Zusätzlich neuer Unterpunkt **Nachfassen** und Erweiterung des Sales-Dashboards.

Bestehende Module (Kunden, Angebote, Aufträge, Finance, Geräteakte, Tickets, Tourenplanung, Wartung, Kundenportal) werden nur **wiederverwendet**, nicht ersetzt.

## Umfang (additiv)

### 1. Datenbank (neue Tabellen, keine Änderung bestehender)
- `sales_leads` – Lead-Datensätze aus Zoho Forms (Felder gem. Vorgabe inkl. `converted_offer_id`, `converted_customer_id`, `metadata jsonb`, `lead_status`).
- `sales_lead_history` – Aktions-/Statushistorie pro Lead.
- `sales_followups` – Nachfass-Aufgaben (Rückruf, Termin, Wiedervorlage) mit Fälligkeit + Status (offen/heute/überfällig/erledigt).
- `integration_logs` – generisches Import-/Webhook-Log.
- Trigger: `updated_at`, automatischer Eintrag in `sales_lead_history` bei Statuswechsel/Konvertierung.
- RLS: Lese-/Schreibzugriff für `Super Admin`, `Admin`, `Vertriebsleitung`, `Vertrieb`; Löschen ausschließlich `Super Admin` (entspricht globaler Regel).
- GRANTs für `authenticated` und `service_role` in derselben Migration.

### 2. Menü
In `AppLayout.tsx` unter **SALES MANAGEMENT** zwei neue Einträge ergänzen, vorhandene unverändert lassen:
- `Anfragen` → `/verkauf/anfragen`
- `Nachfassen` → `/verkauf/nachfassen`

Reihenfolge: Dashboard · Anfragen · Angebote · Kunden · Nachfassen · Aktivitäten · Auswertungen.

### 3. Seiten
- `/verkauf/anfragen` – Liste mit Spalten Datum, Firma, Ansprechpartner, E-Mail, Telefon, Produktinteresse, Quelle, Status, Bearbeiter; Filter (Zeitraum, Produkt, Status, Mitarbeiter, Quelle), Suche, Sortierungen.
- `/verkauf/anfragen/:id` – Detailansicht mit Tabs **Stammdaten**, **Kommunikation**, **Notizen**, **Angebote**, **Historie** und Aktions-Buttons (Angebot erstellen, Kunde zuordnen, Neuen Kunden anlegen, Anfrage bearbeiten, Aufgabe erstellen, E-Mail senden, Nachfass-Termin anlegen, Archivieren).
- `/verkauf/nachfassen` – Aufgabenliste mit Status-Tabs Offen / Heute / Überfällig / Erledigt; Dialoge für Rückruf, Termin, Wiedervorlage, Erinnerung.
- Sales-Dashboard um KPI-Kacheln und Diagramme erweitern (Anfragen heute/Woche/Monat, Offen, Angebote, Volumen, Quote, Bearbeitungszeit, Gewonnene Kunden; Top-Produkte/Vertriebler, Umsatz nach Quelle).

### 4. Aktion „Angebot erstellen"
Klick übernimmt Kunde/Ansprechpartner/Adresse/Produktinteresse/Nachricht in den vorhandenen Angebot-Editor (`AngebotErstellen.tsx`) per `sessionStorage`-Handoff (gleiches Muster wie der bestehende Angebots-Import). Nach Speichern: `sales_leads.converted_offer_id` setzen, Status → `Angebot erstellt`, Eintrag in `sales_lead_history`.

### 5. Duplikatsprüfung
Vor Kunden-/Angebotsanlage Match gegen `customers` in dieser Reihenfolge: E-Mail → Telefon → Firma. Treffer ⇒ verknüpfen statt anlegen. Optionaler Check gegen `zoho_invoices` (Books) und `alixsmart_products`-bezogene Stammdaten zur Anreicherung; keine Dubletten erzeugen.

### 6. Auftrag bei Annahme
Wenn das verknüpfte Angebot den Status „angenommen" erhält: Kunde sicherstellen, Auftrag im bestehenden Auftragsmodul erzeugen, Lead-Status → `Gewonnen`, `converted_customer_id` setzen.

### 7. Zoho Forms Webhook
Edge Function `zoho-forms-import` (POST, `x-api-key`-Auth via Secret `ZOHO_FORMS_WEBHOOK_KEY`):
- legt neue `sales_leads` an oder aktualisiert bestehende (`external_id` + `source`),
- schreibt `integration_logs`,
- triggert In-App-Benachrichtigung (`mail_notifications`) und E-Mail an Vertrieb/Vertriebsleitung/Admin/Super Admin („Neue Vertriebsanfrage eingegangen").

### 8. Benachrichtigungen
Bei neuem Lead: `mail_notifications`-Insert für alle Empfänger der genannten Rollen; optionaler E-Mail-Versand über bestehende `send-transactional-email` Function.

### 9. Auswertungen / Export
Auswertungen-Seite um Reports (Quellen, Abschlussquote/Mitarbeiter und /Produkt, Volumen, Bearbeitungszeit, Conversion Forms→Angebot, Angebot→Auftrag) sowie Export (CSV/Excel via vorhandener `xlsx`, PDF via vorhandenem `jspdf`) erweitern.

## Offene Fragen vor Umsetzung
1. **Datenquelle „Import vorhanden"**: Existiert bereits eine Tabelle / Edge Function, die Zoho-Forms-Daten in Supabase ablegt? Falls ja: welche Tabelle/Spalten — dann lese ich daraus statt eine eigene `sales_leads` zu befüllen. Falls nein: neuer Webhook `zoho-forms-import` wie oben.
2. **Webhook-URL & API-Key**: Soll ich den Secret-Slot `ZOHO_FORMS_WEBHOOK_KEY` anlegen und du trägst den Key später ein?
3. **Rolle „Vertriebsleitung"**: existiert noch nicht im Rollen-Setup (`is_admin`, `Vertrieb`, …). Soll ich sie als neue Rolle aufnehmen oder vorerst auf `Vertrieb` + `Admin`/`Super Admin` mappen?
4. **Auftragsanlage bei Angebotsannahme**: heute gibt es keinen automatisierten Übergang Angebot→Auftrag in AlixWork. Soll dieser Trigger Teil dieser Story sein (eigener Button im Angebot „in Auftrag wandeln") oder später separat?

Sobald diese vier Punkte geklärt sind, setze ich die Migration + UI + Edge Function in einem Rutsch um, ohne bestehende Funktionen anzufassen.
