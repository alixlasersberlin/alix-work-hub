# Kundenportal Phase 2 — Geräte, Verträge, Tickets

Baut auf Phase 1 auf. AlixWork bleibt Master. Portal liest nur.

## Umfang

| Bereich | Route | Datenquelle | Modus |
|---|---|---|---|
| Geräte | `/kunde/geraete` | `lager_devices` (via `reserved_order_id`/`delivered_order_id` → `orders.customer_id`) + `device_maintenance` (`customer_id`) | Read-only |
| Verträge | `/kunde/vertraege` | `finance_contracts` (`customer_id`) | Read-only |
| Tickets | `/kunde/tickets` | `customer_portal_tickets` + `customer_portal_ticket_messages` | Read + Anlegen + Antworten + Schließen |

Feature-Flag: `src/lib/portal/phase.ts` → `PORTAL_PHASE = 2`.

## RLS-Änderungen (Migration Phase 2)

- `lager_devices.portal_customer_select_own_devices` — jetzt sowohl `reserved_order_id` als auch `delivered_order_id` gegen `orders.customer_id = current_portal_customer_id()`.
- `finance_contracts.portal_customer_select_own_contracts` — Portal-Kunde liest eigene Verträge.
- `customer_portal_tickets.cpt_insert_customer` — WITH CHECK erzwingt `customer_id = current_portal_customer_id()` UND `created_by = auth.uid()` (bisher offen).
- `customer_portal_tickets.cpt_update_customer_close` — Portal-Kunde darf UPDATE nur auf eigene Tickets.
- `customer_portal_ticket_messages.cptm_insert` — WITH CHECK erzwingt korrekte `author_id` und Rollen-/Ticket-Zugehörigkeit.

## Rate-Limits

- **Ticket-Anlage**: max 5 pro Stunde pro Kunde (client-seitig geprüft, Audit-Eintrag `ticket_rate_limited` bei Verletzung).

## Audit-Actions (neu)

`device_viewed`, `device_document_downloaded`, `contract_viewed`, `ticket_viewed`, `ticket_created`, `ticket_replied`, `ticket_closed`, `ticket_rate_limited`.

## Edge Functions

- `portal-ticket-notify` — informiert das interne Support-Team bei neuem Ticket / neuer Kundenantwort. Sendet nur wenn `SUPPORT_NOTIFY_EMAIL` + `RESEND_API_KEY` gesetzt sind, sonst nur Audit-Log.

## Rollback

1. `PORTAL_PHASE = 1` setzen — Menüpunkte verschwinden sofort, Routen sind unreachable.
2. Bei RLS-Regression: Migration rückwärts:
   ```sql
   DROP POLICY IF EXISTS portal_customer_select_own_contracts ON public.finance_contracts;
   DROP POLICY IF EXISTS cpt_update_customer_close ON public.customer_portal_tickets;
   -- alte Policies wiederherstellen (siehe Migrationstext).
   ```

## Explizit NICHT in Phase 2

- Keine Änderungen an Geräten oder Verträgen durch den Kunden.
- Kein Katalog/Bestellungen/Angebote/Termine.
- Kein SSO / Alix ID.
