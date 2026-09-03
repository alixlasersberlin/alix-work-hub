---
name: Performance-Optimierung (Stufe 1+2)
description: RLS-Caching via (SELECT f()), Trigram-/Filter-Indizes, Backup-Entlastung — Basis für weitere Performance-Arbeit
type: feature
---
- Ursache Nr. 1 der Langsamkeit war das Voll-Backup (`create-full-backup`), das `audit_logs` seitenweise exportiert: LOG_PAGE_SIZE von 250 auf 1500 erhöht. **Tagsüber laufen keine Backups**: Midday-Backup (Job 34) und Midday-Hetzner-Sync (Job 37) wurden komplett entfernt. Es bleiben nur nächtliche Jobs: daily-full-backup 22:00 UTC (10), hetzner-sync-nightly 22:30 UTC (36), weekly-full-backup So 03:00 UTC (11).
- RLS: Policies müssen Rollenfunktionen als `(SELECT f())` bzw. `= ANY (ARRAY(SELECT unnest(user_tenant_codes())))` aufrufen — sonst pro Zeile ausgewertet. Umgestellt: `zoho_items`, `customers`, `orders` (SELECT-Policies).
- Indizes: pg_trgm auf customers(company_name, contact_name), zoho_items(name, sku); Filterindizes auf production_orders, orders(expected_shipment_date, deposit_ok), zoho_invoices(region/mietkauf + raw_data GIN), route_plans, offers, order_items, email_send_log, audit_logs, esc_audit_log.
- Offen (Stufe 3+4): serverseitige Pagination statt `fetchAllPages` in Invoices/Kunden/Artikel/Lager, React-Query-Caching, Code-Splitting großer Seiten, Tabellen-Virtualisierung.
