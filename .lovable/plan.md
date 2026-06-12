## Ziel
Bestehendes Modul **Sales Leads** (`/verkauf/anfragen`) zu einem standardisierten Lead‑Import → Angebotsworkflow ausbauen, **ohne bestehende Funktionen zu brechen**. Nutzt die schon vorhandene Tabelle `sales_leads`, Detail-/Listen-Seite, Followups, Zoho‑Forms‑Webhook und den Angebot‑Handoff zu `/verkauf/angebot/neu`.

## Was schon existiert (wird wiederverwendet)
- Tabelle `sales_leads` inkl. Felder `service_rating`, `additional_interests` (jsonb), `delivery_preference`, `consultation_type`, `requested_products`, `notes`, `converted_offer_id`, `converted_customer_id`, `lead_score`, `assigned_user`, `lead_status`, `source`.
- Tabellen `sales_lead_history`, `sales_followups`, Edge Function `zoho-forms-import`.
- Routen `/verkauf/anfragen`, `/verkauf/anfragen/:id`, `/verkauf/nachfassen`, `/verkauf/anfragen/neu` (NeueAnfrage – Wizard).
- Handoff `sessionStorage.sales_lead_handoff_v1` → `/verkauf/angebot/neu` (Kunde + Notizen prefilled).

## Lücken zum gewünschten Workflow
1. Keine sprechende **Leadnummer** `LEAD-YYYY-000001`.
2. Kein dediziertes Feld `device_category` / `customer_goal` / `implementation_period` (heute steckt das in `requested_products` / `interests`).
3. Quellen-Vielfalt (Telefon / WhatsApp / Website / API / CSV / manuell) nicht klar abgebildet.
4. Kein **CSV-Import** und kein generisches **API‑Endpoint** (nur Zoho Forms Webhook).
5. Beim Klick „Angebot erstellen" wird zwar gehandoffed, aber **Geräteklasse + Zusatzleistungen + Ziel + Zeitraum** werden nicht ins Angebot übernommen, und der Status wird **nicht automatisch** auf „Angebot erstellt" gesetzt + `converted_offer_id` nicht zurückgeschrieben.
6. Kein automatischer Followup „Kontaktaufnahme erforderlich" bei Import.
7. Kein KPI‑Dashboard für Vertriebsanfragen.

## Umsetzung

### 1. Migration (additiv, keine Breaking Changes)
Neue Spalten auf `sales_leads`:
- `lead_number text unique` (Default via Trigger)
- `device_category text`
- `additional_services jsonb` (Array of strings)
- `customer_goal text`
- `implementation_period text`

Plus:
- Sequence `sales_lead_seq` + Trigger `assign_sales_lead_number()` setzt `LEAD-YYYY-000000` bei Insert, falls leer.
- Trigger `sales_lead_after_insert()` → erzeugt automatisch einen `sales_followups`-Eintrag „Kontaktaufnahme erforderlich" mit Fälligkeit +1 Werktag, sofern Status = „Neu" / „Importiert - Angebot offen".

Backfill: bestehende Zeilen erhalten Leadnummern in Reihenfolge `created_at`.

### 2. Edge Function `zoho-forms-import` erweitern
Mapping ergänzen für: `device_category`, `additional_services`, `customer_goal`, `implementation_period`, `lead_source` (z. B. „Telefonisch / WhatsApp", „Website", „API"). Bestehendes Schema bleibt rückwärtskompatibel.

### 3. Neue Edge Function `sales-leads-import`
Generisches JSON‑API (auth über Header `x-api-key` / `SALES_LEADS_API_KEY`) für Website/API/WhatsApp. Akzeptiert flache + verschachtelte Struktur aus dem Beispiel-JSON.

### 4. UI

**`/verkauf/anfragen` Liste**
- Spalte „Leadnummer" + „Geräteklasse" ergänzen, Filter „Quelle" um Telefon/WhatsApp/Website erweitern, Geräteklasse‑Filter, Bewertungs‑Filter, Zeitraum‑Filter.

**`/verkauf/anfragen/:id` Detail**
- Block „Interesse" zeigt `device_category`, `additional_services`, `customer_goal`, `implementation_period`.
- Button **„Angebot erstellen"**: schreibt erweiterten Handoff (inkl. Geräteklasse + Services + Ziel + Zeitraum), setzt `lead_status='Angebot erstellt'`, legt `sales_lead_history`-Eintrag an. Nach Rückkehr aus dem Angebotseditor wird via `converted_offer_id` verknüpft (Hook im `AngebotErstellen`-Save‑Pfad, der bei aktivem Handoff zurückschreibt).

**`/verkauf/anfragen/neu` (NeueAnfrage Wizard)**
- Felder Geräteklasse + Zusatzleistungen + Ziel + Zeitraum + Quelle ergänzen.

**Neu: `/verkauf/anfragen/import`**
- CSV‑Import (Drag&Drop, Spalten‑Mapping, Preview), nutzt bestehendes Schema. Manuelle Einzeleingabe ist über NeueAnfrage abgedeckt.

**Neu: `/verkauf/anfragen/dashboard`**
- KPIs: Neue Leads heute / Monat, Angebote erstellt, Abschlussquote (Gewonnen / Gesamt), Ø Bewertung, Top‑Geräteklasse, Aufschlüsselung nach Quelle.

### 5. Menü `AuroraTopNav`
Unter „SALES MANAGEMENT" → „Verkaufsanfragen" als Eltern‑Eintrag mit Untermenü:
- Übersicht (`/verkauf/anfragen`)
- Dashboard (`/verkauf/anfragen/dashboard`)
- Import (`/verkauf/anfragen/import`)
- Neue Anfrage (`/verkauf/anfragen/neu`)
- Nachfassen (`/verkauf/nachfassen`)

### 6. RBAC
Bestehende Rollenliste bleibt: `Super Admin`, `Admin`, `Vertrieb`, `Vertriebsleitung`, `Order`, `SACHBEARBEITUNG`. Delete: nur Super Admin (Memory-Regel).

## Out of scope (separater Schritt)
- Tiefere Integration in Produktion/Finance/Auslieferung — Lead→Angebot→Auftrag→Produktion ist im AlixWork‑Flow bereits implementiert, sobald aus dem Angebot ein Auftrag entsteht.
- Direkter WhatsApp‑Webhook (kann später als zweite Edge Function über die existierende WhatsApp‑Infrastruktur ergänzt werden).

## Hinweis zu Secrets
Für die neue Import‑API wird ein neues Secret `SALES_LEADS_API_KEY` benötigt — frage ich nach Plan‑Freigabe an.