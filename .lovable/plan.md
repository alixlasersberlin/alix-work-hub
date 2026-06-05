
# Plan: Modul „Reparaturannahme"

Ein eigenständiges, klar abgegrenztes Modul unter dem bestehenden Menüpunkt **REPARATURANNAHME** (heute Platzhalter unter Tourenplanung). Keine bestehenden Tabellen, Policies oder Module werden verändert – nur neue Tabellen, neue Routen, neue Komponenten und eine optionale Lese-Anbindung an `orders`, `customers`, `finance_records`, `production_orders` (Bestellwesen) und `route_plans`.

## 1. Datenmodell (alle Tabellen NEU, `repair_*` Präfix)

Migration im `public`-Schema, mit GRANTs + RLS gemäß Projekt-Konvention.

- **repair_orders** – Hauptauftrag
  - `repair_number` (TEXT, UNIQUE, Format `REP-YYYY-NNNN`, via Sequenz `repair_order_seq` + Trigger)
  - `source` (`existing_order` | `new_customer`)
  - `order_id` (uuid, FK-soft auf `orders.id`, optional)
  - `customer_id` (uuid, FK-soft auf `customers.id`, optional)
  - Snapshot-Felder für Neukunden: `customer_company`, `customer_contact`, `customer_email`, `customer_phone`, `customer_street`, `customer_zip`, `customer_city`
  - Geräte-Felder: `device_type`, `serial_number`, `purchase_date`, `accessories`
  - Fehler-Felder: `customer_error_description`, `visible_damages`, `powers_on` (bool), `error_permanent` (bool)
  - `priority` (`Normal` | `Eilig` | `Garantie` | `Kulanz` | `Kostenpflichtig`)
  - `status` (enum-ähnlich text, Default `Reparatur angelegt`)
  - `acceptance_date`, `handler` (uuid → user_profiles)
  - Standard: `created_at`, `updated_at`, `created_by`, `updated_by`

- **repair_status_history** – Protokoll jeder Statusänderung (`repair_id`, `old_status`, `new_status`, `changed_by`, `created_at`, `note`). Trigger schreibt automatisch bei Status-Update.

- **repair_workshop_intake** (1:1) – Werkstattannahme: `arrival_date`, `condition_on_arrival`, `serial_checked` (bool), `accessories_checked` (bool), `visual_check`, `matches_customer_description` (bool), `internal_note`.

- **repair_work_orders** (1:1 zum Reparaturauftrag) – Technik-Arbeitsauftrag:
  - `work_order_number` (`AA-REP-YYYY-NNNN`)
  - `technician_id` (uuid), `task_description`
  - `diagnosis`, `error_confirmed` (bool), `root_cause`
  - `work_performed`, `work_time_minutes`
  - `repair_successful` (bool), `test_run_done` (bool), `safety_check_done` (bool)
  - `closing_note`, `technician_signature_name`, `signed_at`
  - `pdf_path` (Storage), `printed_at`

- **repair_spare_parts** (N:1) – pro Arbeitsauftrag:
  - `name`, `sku`, `quantity`, `reason`, `in_stock` (bool), `urgency`, `supplier_name`, `ordered_via_production_order_id` (uuid, optional, FK-soft auf `production_orders.id`)

- **repair_finance_handover** (1:1) – Übergabe Finance: Snapshot der Reparaturdaten, `handed_over_at`, `handed_over_by`, `invoice_proposal_amount`, `billing_mode` (Garantie/Kulanz/Kostenpflichtig), `invoice_created` (bool), `invoice_reference`, `notes`.

- **repair_delivery_handover** (1:1) – Übergabe Tourenplanung: `desired_delivery_date`, `delivery_address` (jsonb), `delivery_notes`, `invoice_paid` (bool), `pickup_or_delivery` (enum), `route_plan_id` (uuid, FK-soft).

- **repair_attachments** – Datei-Uploads je Phase (`repair_id`, `phase` = annahme|werkstatt|technik|abschluss, `file_path`, `file_name`, `file_type`, `uploaded_by`).

- **repair_notifications** – interne Benachrichtigungen (`repair_id`, `event_type`, `recipient_role`, `message`, `created_at`, `read_at`).

- **repair_customer_emails** – geplante Kundenmails (`repair_id`, `event_type`, `subject`, `body`, `status` = draft|approved|sent, `approved_by`, `sent_at`). Nur Versand nach Freigabe durch Super Admin oder Finance.

- **Storage-Bucket** `repair-files` (privat) für Fotos, Prüfprotokolle, generierte PDFs.

### RLS-Policies (neue Rolle nicht nötig, bestehende Rollen werden verwendet)
- SELECT: alle authentifizierten Benutzer (alle Rollen dürfen lesen) – per `to authenticated using (true)`.
- INSERT/UPDATE auf `repair_orders`, `repair_workshop_intake`, `repair_work_orders`, `repair_spare_parts`: `is_admin() OR has_role('Order') OR has_role('Tourenplanung') OR has_role('Finance') OR has_role('QM')`. Werkstatt/Technik nutzen vorhandene Rollen (Order/QM).
- `repair_finance_handover` Schreibrechte: `can_access_finance()`.
- `repair_delivery_handover` Schreibrechte: `can_manage_planning()`.
- DELETE überall: nur `has_role('Super Admin')`.
- `repair_customer_emails.status` darf nur Super Admin / Finance auf `approved` setzen (Check via Trigger).

## 2. Navigation & Routing

- Bestehendes Menü **REPARATURANNAHME** in `AppLayout.tsx` zu einer **Gruppe** mit Unterpunkten ausbauen (analog zu Tourenplanung). Keine Veränderung an anderen Menü-Gruppen.
- Unterpunkte → Routen unter `/reparatur/*`:
  - `/reparatur` – Dashboard (Default)
  - `/reparatur/neu` – Neue Reparatur anlegen
  - `/reparatur/auftraege` – Liste Reparaturaufträge
  - `/reparatur/:id` – Detail-/Bearbeitungsseite (Tabs: Annahme · Werkstatt · Technik · Ersatzteile · Finance · Tourenplanung · Verlauf · Dateien)
  - `/reparatur/werkstattannahme` – Liste offene Werkstattannahmen
  - `/reparatur/technik` – Liste Technik-Arbeitsaufträge
  - `/reparatur/ersatzteile` – Liste Ersatzteilbedarf
  - `/reparatur/finance` – Übergaben Finance
  - `/reparatur/tourenplanung` – Übergaben Tourenplanung
  - `/reparatur/archiv` – Abgeschlossene/Stornierte
- Alle Routen in `src/App.tsx` neu registrieren, ohne bestehende Routen anzufassen.

## 3. UI-Komponenten (neu, unter `src/pages/Reparatur/` und `src/components/repair/`)

- `RepairDashboard.tsx` – Kennzahlen-Kacheln (offen, eingetroffen, in Technik, Ersatzteile offen, Übergaben offen) + Filterleiste (Status, Kunde, Gerät, Techniker, Reparaturnummer, Zeitraum, Garantie/kostenpflichtig/Kulanz).
- `RepairNew.tsx` – Wizard mit Tab „Option A – bestehender Auftrag" (Suche über Auftragsnr, Kundenname, Firma, PLZ, Telefon, E-Mail, Seriennummer, Gerätetyp – via Supabase-Queries auf `orders` + `customers`, inkl. gelieferter Aufträge) und Tab „Option B – Neukunde". Pflichtfeld-Validierung, Fehlerbeschreibung inkl. Datei-Upload.
- `RepairList.tsx` – Liste mit Status-Badges, schnellem Statuswechsel, Verlinkung ins Detail.
- `RepairDetail.tsx` – Tab-Layout, Statusleiste mit allen 18 Workflow-Schritten.
- `RepairWorkshopForm.tsx` – Werkstattannahme-Formular inkl. Foto-Upload.
- `RepairWorkOrderForm.tsx` – Technik-Bearbeitung (Diagnose, Arbeiten, Zeit, Prüfungen, Unterschrift).
- `RepairSparePartsManager.tsx` – Ersatzteilliste, Knopf „Bestellvorschlag erzeugen" (siehe Punkt 4).
- `RepairFinanceHandover.tsx`, `RepairDeliveryHandover.tsx`, `RepairAttachments.tsx`, `RepairHistory.tsx`.
- Statusänderungen erfolgen ausschließlich über typisierte Helper, der parallel `repair_status_history` schreibt (per DB-Trigger – kein Doppel-Insert nötig).

## 4. PDF Technik-Arbeitsauftrag

- Neues Modul `src/lib/repair-work-order-pdf.ts` (orientiert sich an `src/lib/production-order-pdf.ts`, aber eigenständig).
- Erzeugt PDF mit allen geforderten Feldern (Reparaturnummer, Auftragsnummer, Kunde, Gerät, Seriennummer, Fehler, Werkstattannahme, Schäden, Zubehör, Priorität, Techniker, Aufgabe, Diagnose, durchgeführte Arbeiten, Ersatzteile, Arbeitszeit, Abschluss, Unterschrift, Datum).
- Speicherung im Bucket `repair-files` unter `work-orders/{repair_id}/{work_order_number}.pdf`, Pfad in `repair_work_orders.pdf_path`.
- Buttons „PDF erzeugen", „Erneut herunterladen", „Drucken" (`window.print()` auf druckoptimierter HTML-Vorschau).

## 5. Anbindung an Bestellwesen (read-only Erweiterung)

- Kein Schema-Eingriff in `production_orders`. Stattdessen:
  - Beim Knopf „Bestellvorschlag erzeugen" wird ein neuer `production_orders`-Datensatz mit `source = 'Reparaturbedarf'` (existierendes Textfeld nutzen oder neue Notiz) angelegt. Falls `production_orders.source` nicht existiert: stattdessen `anmerkungen` mit Header `[Quelle: Reparaturbedarf REP-…]` befüllen.
  - Verweis wird in `repair_spare_parts.ordered_via_production_order_id` gespeichert.
- Falls UI im bestehenden Bestellwesen einen Filter „Quelle = Reparaturbedarf" zeigen soll, wird das in einem späteren Schritt geprüft (nicht Teil dieses Plans, da keine Änderung am bestehenden Modul gewünscht).

## 6. Anbindung Finance & Tourenplanung

- **Finance-Übergabe**: Button auf Detail → erstellt `repair_finance_handover`-Datensatz, Status wechselt zu „Übergabe an Finance". Finance-User sieht eigene Liste `/reparatur/finance`. Nach Eintrag `invoice_reference` → Status „Rechnung erstellt".
- **Tourenplanungs-Übergabe**: Button → erstellt `repair_delivery_handover`, Status „Übergabe an Tourenplanung". Optionale Verknüpfung zu `route_plans.id` (nur Lese-Pick aus bestehender Tabelle, keine Pflicht).

## 7. Benachrichtigungen & Kunden-E-Mails

- DB-Trigger `repair_event_notify` schreibt bei definierten Statuswechseln einen Eintrag in `repair_notifications` (event_type je Phase, recipient_role passend zur Phase).
- Globale Badge im Header (klein, nur sichtbar wenn ungelesen) → optional, einfache Implementierung über Polling alle 60 s.
- Kunden-Mails: Vorlage wird im Modul als Entwurf erzeugt, sichtbar in `RepairDetail` Tab „Kommunikation". Versand-Button nur aktiv für Super Admin oder Finance, ruft bestehende `send-transactional-email` Edge Function. Keine Änderung an der Edge-Function nötig (generisches Template oder neues Template `repair-status-update` in `_shared/transactional-email-templates/`).

## 8. Berechtigungen im UI

- Sichtbarkeit „REPARATURANNAHME"-Menü: alle Rollen (Lesen).
- Edit-Buttons in den Tabs werden je Rolle ausgeblendet (Helper `useRepairPermissions()`):
  - Annahme/Werkstatt: Order, Tourenplanung, Admin, Super Admin
  - Technik/Ersatzteile: Order, QM, Admin, Super Admin
  - Finance-Tab: Finance, Admin, Super Admin
  - Tourenplanung-Tab: Tourenplanung, Order, Admin, Super Admin
  - Vertrieb-Rollen: nur Read

## 9. Implementierungs-Reihenfolge

1. Migration: Tabellen, Sequenz, Trigger (status history, repair_number, notifications), GRANT + RLS, Storage-Bucket-Policies.
2. Menü-Ausbau (`AppLayout.tsx`) und Routen-Registrierung (`App.tsx`), Platzhalter-Komponenten.
3. „Neue Reparatur anlegen" + Liste + Detail-Skelett.
4. Werkstattannahme + Technik-Arbeitsauftrag (inkl. PDF).
5. Ersatzteile + Bestellvorschlag-Brücke.
6. Finance- und Tourenplanungs-Übergabe.
7. Dashboard, Filter, Benachrichtigungen.
8. Kunden-Mail-Entwürfe + Freigabe-Workflow.
9. Smoke-Test über alle 18 Statusschritte.

## Technische Details

- Reparaturnummer per Postgres-Sequenz `repair_order_seq` + Trigger `assign_repair_number`. Jahr aus `to_char(now(),'YYYY')`. Sequenz wird jährlich nicht automatisch zurückgesetzt – Format bleibt eindeutig (`REP-2026-00001`).
- Status als TEXT mit CHECK-Constraint auf erlaubte Werte (Liste der 18 Schritte). Validierungs-Trigger (kein CHECK auf zeitabhängiges) prüft Übergänge erlaubt (z. B. nur vorwärts oder explizit „Storniert").
- Status-History via Trigger `log_repair_status_change` (analog zu `log_order_status_change`).
- Soft-Foreign-Keys auf `orders`, `customers`, `production_orders`, `route_plans` ohne `REFERENCES` – damit kein Cascade-Risiko bei bestehenden Daten.
- Storage-Bucket `repair-files` mit Policies analog `bug-capa-attachments` (nur authentifizierte Schreiber mit passenden Rollen, Lesen für alle authentifizierten).
- TypeScript-Helpers in `src/lib/repair/` (Statusliste, Übergangsregeln, Berechtigungs-Hook, PDF-Helper).
- Keine Änderungen an: `orders`, `customers`, `finance_records`, `production_orders`, `route_plans`, `user_profiles`, `roles`, `user_roles`, bestehenden Edge Functions, bestehenden Email-Templates, bestehenden RLS-Policies.

## Offene Punkte zur Bestätigung (vor Build)

1. **Techniker-Unterschrift**: reicht getippter Name + Zeitstempel, oder ist Signatur-Pad (Canvas) gewünscht?
2. **Rolle „Werkstatt" / „Technik" / „Vertrieb"** existieren aktuell nicht eigenständig – sollen diese als neue Rollen angelegt werden, oder mappen wir wie oben auf die bestehenden Rollen (Order, QM, Finance, Tourenplanung)?
3. **Bestellwesen-Anbindung**: Quelle „Reparaturbedarf" als reine Notiz im `anmerkungen`-Feld eintragen (zero impact) – einverstanden?
4. **Kunden-E-Mail-Template**: ein generisches Template mit Status-Variable, oder pro Event ein eigenes Template?
