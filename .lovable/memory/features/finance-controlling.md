---
name: Finance Controlling
description: Zentrale Rechnungs-Kontrollstelle unter Buchhaltung (/finance/finance-controlling), Tabellen fc_cases/fc_events, DB-Trigger auf orders/delivery_appointments/repair_orders/zoho_invoices
type: feature
---
- Route: `/finance/finance-controlling`, Menü: BUCHHALTUNG › DASHBOARD › „Finance Controlling".
- Tabellen: `fc_cases` (Vorgänge inkl. Ampel, Status, Prio, noch-zu-fakturieren vs. noch-zu-bezahlen) und `fc_events` (Historie + interne Kommentare).
- Automatik über DB-Trigger: Auftragsstatus (bestätigt / teilgeliefert / geliefert / geschlossen-invoiced), `delivery_appointments` (ausgeliefert / teilweise ausgeliefert), `repair_orders` (Reparatur abgeschlossen). Rechnungen (`zoho_invoices`) aktualisieren die Beträge über `fc_refresh_order`.
- Duplikatschutz: Unique (source_table, source_id, trigger_event).
- Rein additiv: keine bestehenden Prozesse/Status verändert; „Rechnung erstellen" öffnet die vorhandene Auftrags-/Reparaturfunktion, keine eigene Rechnungslogik.
- Kein automatisches Blockieren von Aufträgen (nur Kontroll-/Eskalationssystem).
