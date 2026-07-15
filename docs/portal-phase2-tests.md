# Kundenportal Phase 2 — Manuelle Sicherheits- & Abnahmetests

Voraussetzung: Phase 1 vollständig grün. Testkunden **A** und **B** (unterschiedliche `customer_id`) mit je 1 Gerät, 1 Vertrag, 1 Ticket.

## A. Geräte (`/kunde/geraete`)

| # | Testfall | Erwartung |
|---|---|---|
| A1 | Kunde A ruft Geräte auf | Nur eigene Geräte + Wartungseinträge |
| A2 | DevTools: `select` auf `lager_devices` mit fremdem `reserved_order_id` | RLS liefert 0 Zeilen |
| A3 | Gerät ohne Order-Verknüpfung, aber `device_maintenance.customer_id = A` | Erscheint als Wartungs-Karte |
| A4 | Audit-Eintrag `device_viewed` mit `customer_id = A` vorhanden | Ja |

## B. Verträge (`/kunde/vertraege`)

| # | Testfall | Erwartung |
|---|---|---|
| B1 | Kunde A sieht nur eigene Verträge | Ja |
| B2 | DevTools: `select` mit fremder `customer_id` | 0 Zeilen (RLS) |
| B3 | Vertrag mit `status='active'` und `monthly_rate`/`remaining_amount` | Werte korrekt formatiert als EUR |
| B4 | Audit `contract_viewed` gesetzt | Ja |

## C. Tickets

| # | Testfall | Erwartung |
|---|---|---|
| C1 | Neues Ticket anlegen | Erscheint sofort in Liste, Status „Offen", Audit `ticket_created` |
| C2 | 6 Tickets in <1 h anlegen | Ab dem 6. Fehlermeldung, Audit `ticket_rate_limited` |
| C3 | DevTools: `insert` mit fremder `customer_id` | RLS blockt (`new row violates row-level security policy`) |
| C4 | DevTools: `insert` mit eigener `customer_id` aber fremdem `created_by` | RLS blockt |
| C5 | Message-`insert` mit `from_role='staff'` als Portal-User | RLS blockt |
| C6 | Antwort schreiben auf eigenes Ticket | Message erscheint, Audit `ticket_replied` |
| C7 | Antwort auf fremdes Ticket versuchen (DevTools) | RLS blockt |
| C8 | Ticket schließen | Status „Geschlossen", Antwortfeld verschwindet, Audit `ticket_closed` |
| C9 | Antworten durch AlixWork-Mitarbeiter (im Admin) | Erscheint mit `from_role='staff'` beim Kunden |

## D. Feature-Flag / Navigation

| # | Testfall | Erwartung |
|---|---|---|
| D1 | Sidebar zeigt: Übersicht, Rechnungen, Geräte, Verträge, Tickets, Meine Daten | Ja |
| D2 | Dashboard-Kacheln zeigen echte Zählwerte | Ja |
| D3 | `PORTAL_PHASE=1` gesetzt → Menü fällt zurück auf Phase 1 | Sofort |
| D4 | Direktaufruf `/kunde/bestellungen`, `/kunde/katalog` | Redirect `/kunde` |

## E. Ticket-Notify Edge Function

| # | Testfall | Erwartung |
|---|---|---|
| E1 | Portal-User ruft Function für eigenes Ticket auf | 200, Audit-Eintrag `ticket_notify_new/reply` |
| E2 | Portal-User ruft Function für fremdes Ticket auf | 403 |
| E3 | Ohne Auth-Header | 401 |
| E4 | Mit gesetztem `SUPPORT_NOTIFY_EMAIL` + `RESEND_API_KEY` | E-Mail geht an Support-Adresse |

## Freigabe

Nur nach 100 % Pass A–E und Gegenzeichnung durch Geschäftsleitung + Datenschutz.
