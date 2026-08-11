---
name: Zoho Kunden-Sync nur manuell
description: Automatischer Kundenimport aus Zoho (Cron daily-customer-sync-de/at) ist deaktiviert – Abgleich nur manuell
type: constraint
---
Der automatische Kundenimport aus Zoho ist abgeschaltet (Cron-Jobs `daily-customer-sync-de` und `daily-customer-sync-at` wurden entfernt, 11.08.2026).

- Kundenabgleich erfolgt ausschließlich manuell über die Import-/Abgleich-Oberflächen.
- Keine neuen Cron-Jobs für `scheduled-customer-sync` anlegen, ohne dass der Nutzer es ausdrücklich verlangt.
- Auftrags-Sync (`daily-order-sync-de/at`) läuft weiter, aber ohne `auto_sync_customers`.
