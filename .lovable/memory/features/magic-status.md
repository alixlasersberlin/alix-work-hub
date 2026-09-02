---
name: MAGIC STATUS
description: Zentrales Such-, Status- und Prozessmotor-Modul unter /magic (Tabellen magic_status_workflows/magic_status_log, orders.magic_status)
type: feature
---
MAGIC STATUS („Suchen. Ändern. Ausführen.") ist die zentrale operative Steuerung des Auftragslebenszyklus.

- Route `/magic`, Top-Level-Menüpunkt, zusätzlich über ⌘/Ctrl+K erreichbar (Auftragstreffer öffnen `/magic?order=<id>`).
- Code: `src/lib/magic/statuses.ts` (Statusmodell + Rollen), `src/lib/magic/search.ts` (globale Suche), `src/lib/magic/engine.ts` (Dossier, Voraussetzungen, Automationen), `src/pages/Magic/*`.
- Keine parallelen Datensilos: liest/schreibt orders, customers, production_orders, lager_devices, zoho_invoices, tickets.
- DB: `orders.magic_status/_at/_by`, `magic_status_workflows` (konfigurierbar, nur Super Admin schreibt), `magic_status_log` (WORM, nur Insert/Select).
- Regeln: Statuswechsel nur bei erfüllten Voraussetzungen; doppelte Seriennummern werden blockiert; jede Aktion wird mit ausgeführten/fehlgeschlagenen Schritten protokolliert; Teilfehler werden als „NICHT FINALISIERT" angezeigt – keine stillen Fehler.
