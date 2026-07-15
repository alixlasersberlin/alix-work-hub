# Phase 2 — Kundenportal-Ausbau: Geräte, Verträge, Tickets

Aufbauend auf Phase 1 (Login + Rechnungen + Meine Daten). Prinzip bleibt: **AlixWork ist Master**, das Portal liest nur, keine Parallel-Datenbank, RLS über `current_portal_customer_id()`.

## Umfang

Drei neue Portal-Bereiche werden freigeschaltet:

1. **Geräte** (`/kunde/geraete`) — Übersicht aller Geräte des Kunden aus `lager_devices` (nur `customer_id = current_portal_customer_id()`).
   Anzeige: Modell, Seriennummer, Kaufdatum, Garantie-Status, letzte Wartung. Read-only. Detailseite mit Wartungshistorie aus `device_maintenance`.

2. **Verträge** (`/kunde/vertraege`) — Laufende Serviceverträge & Wartungspläne aus `maintenance_plans` (+ ggf. `finance_contracts` für Ratenzahlungen wenn zum Kunden zugeordnet).
   Anzeige: Vertragstyp, Laufzeit, nächster Termin, monatliche Kosten, Status. PDF-Download über Edge Function.

3. **Tickets** (`/kunde/tickets`) — Eigene Support-Tickets aus `customer_portal_tickets` (bereits vorhanden).
   Neu: Kunde kann Tickets **anlegen** (Typ, Betreff, Beschreibung, optional Gerät verknüpfen) und **antworten** über `customer_portal_ticket_messages`. Admin-Antworten werden im Portal sichtbar.

## Sicherheit

- Alle Reads über RLS auf `current_portal_customer_id()`.
- Ticket-Anlage: Client-Insert mit RLS-Check `customer_id = current_portal_customer_id()`.
- Gerätedokumente (Handbücher, Wartungsprotokolle) NUR über neue Edge Function `portal-device-document-download` (analog zu `portal-invoice-download`).
- Rate-Limit für Ticket-Anlage: max 5/Stunde pro Kunde (Client + Audit-Log-Check).
- Alle Aktionen → `customer_portal_audit_logs` (`device_viewed`, `contract_viewed`, `ticket_created`, `ticket_replied`, `document_downloaded`).

## Datenbank-Änderungen (Migration)

- RLS auf `lager_devices`: Portal-User darf nur eigene Geräte lesen (zusätzliche Policy, interne Policies unverändert).
- RLS auf `device_maintenance`: analog, verknüpft über `device_id → lager_devices.customer_id`.
- RLS auf `maintenance_plans`: analog über `customer_id`.
- `customer_portal_ticket_messages`: RLS-Policies erweitern (INSERT für Kunde erlauben, wenn Ticket ihm gehört).
- `customer_portal_tickets`: INSERT-Policy für Portal-User, UPDATE nur auf `status='closed'` durch Kunde erlaubt.
- Keine neuen Tabellen.

## Edge Functions

- `portal-device-document-download` — signierte URL für Gerätedokumente (60s), Ownership-Check.
- `portal-ticket-notify` — sendet Admin-Benachrichtigung bei neuem Ticket/Antwort (Supabase Auth SMTP).

## UI

- Portal-Layout erweitern: neue Menüpunkte **Geräte, Verträge, Tickets** hinter Feature-Flag `PORTAL_PHASE >= 2`.
- Dashboard bekommt drei zusätzliche Kacheln (Anzahl Geräte, aktive Verträge, offene Tickets).
- Design: bestehendes dunkles Silber + Gold, mobile-first.

## AlixWork Admin

- Bestehender Tab „Kundenportal" bekommt Sektion **Ticket-Antwort** — Mitarbeiter kann direkt aus dem Kundendetail auf Portal-Tickets antworten.
- Neue Rolle-Flags: `customer_portal.reply_tickets` (Super Admin, Support, Geschäftsleitung).

## Reihenfolge

1. Migration (RLS auf lager_devices / device_maintenance / maintenance_plans / customer_portal_ticket_messages).
2. Feature-Flag hochziehen (`PORTAL_PHASE=2`), Layout + Dashboard-Kacheln.
3. Geräte-Seite (Liste + Detail + Wartungshistorie).
4. Verträge-Seite.
5. Tickets-Seite (Liste, Anlage, Antworten) + Edge Function `portal-ticket-notify`.
6. Edge Function `portal-device-document-download`.
7. AlixWork Admin-Erweiterung (Ticket-Antwort).
8. Dokumentation `docs/customer-portal-phase2.md` + Tests `docs/portal-phase2-tests.md`.

## Explizit NICHT in Phase 2

- Keine Alix ID / SSO über Portale hinweg.
- Kein Katalog/Warenkorb/Bestellungen.
- Keine Rechnungszahlung im Portal.
- Keine Änderungen an Geräte-/Vertragsdaten durch den Kunden — nur Read + Ticket.

Nach jedem Schritt Zwischencheck durch dich, bevor der nächste startet.
