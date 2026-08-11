---
name: Zoho Sync nur manuell (Kunden + Aufträge)
description: Automatischer Kunden- und Auftragsimport aus Zoho ist deaktiviert – jeder Abgleich erfolgt nur manuell
type: constraint
---
Automatische Zoho-Syncs sind abgeschaltet (11.08.2026):

- Entfernte Cron-Jobs: `daily-customer-sync-de`, `daily-customer-sync-at`, `daily-order-sync-de`, `daily-order-sync-at`, `zoho-orders-reconcile-hourly`.
- Kunden- und Auftragsabgleich erfolgt ausschließlich manuell über die Import-/Abgleich-Oberflächen (z. B. „Aufträge gesucht“ / Zoho-Abgleich).
- Keine neuen Cron-Jobs für Kunden- oder Auftrags-Sync anlegen, ohne dass der Nutzer es ausdrücklich verlangt.
- Rechnungs-Importe (`zoho-invoices-auto-import`) bleiben davon unberührt.
