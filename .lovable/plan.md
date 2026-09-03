# Performance-Analyse ALIXWORK — Befund & Maßnahmenplan

## Kurzfassung

Die Datenbank ist nicht durch „zu viele Daten" langsam (Aufträge: 1.066 Zeilen, Kunden: 3.118, Artikel: 3.017), sondern durch **Dauerlast von Hintergrund-Abfragen** und **pro Zeile ausgewertete Sicherheitsregeln**. Dazu kommen Seiten, die immer *alle* Datensätze mit *allen* Spalten laden.

## Die vier Hauptursachen

### 1. Audit-Log-Dauerlast frisst die Datenbank (mit Abstand Platz 1)
- `SELECT * FROM audit_logs` (ohne Filter): 33.023 Aufrufe, ⌀ 1,4 s, **zusammen ~12,7 Stunden** Rechenzeit.
- Eine zweite, seitenweise Variante: **2.612.720 Aufrufe** (~3,1 Stunden).
- Tabellen: `esc_audit_log` 210 MB, `audit_logs` 171 MB, `app_notifications` 29 MB, `delivery_approval_tokens` 46.604 Zeilen.

Solange dieser Dauerläufer die CPU belegt, ist **jede** andere Abfrage langsam — auch kleine. Messung: 200 Zeilen aus `orders` über den Primärschlüssel brauchen aktuell 18 ms statt <1 ms.

### 2. Sicherheitsregeln (RLS) werden pro Zeile neu berechnet
253 Policies rufen Rollenfunktionen ohne Caching auf. Beispiele: `tenant_scope_ok(source_system)`, `can_access_orders() OR can_access_finance()` auf `zoho_items`, `production_orders` (12 Policies), `lager_devices` (11 Policies).
Jede dieser Funktionen macht intern eine Abfrage auf `user_roles`/`roles` — bei 3.000 Artikeln also bis zu mehrere tausend Zusatzabfragen pro Seitenaufruf. Deshalb dauert die Artikelabfrage ⌀ 3,3 s.

### 3. Listen laden alles statt seitenweise
- `zoho_items` komplett (1.808 Aufrufe, ⌀ 3,3 s)
- `customers` komplett sortiert (⌀ 2,5 s)
- `orders` mit Kunde + Positionen als verschachtelte Abfrage (⌀ 2,2 s)
- `zoho_invoices` inkl. `raw_data` (JSON-Rohdaten, ⌀ 1,5 s) — in `Invoices.tsx` über `fetchAllPages`
- `production_orders`-Zähler werden 3× separat geladen (17.990 + 9.363 + 8.956 Aufrufe)
- `Logfiles.tsx` lädt 2.000 Zeilen auf einmal

### 4. Suche ohne passende Indizes
Kundensuche `ILIKE` über Firmen- und Kontaktname: ⌀ 2,2 s, weil kein Trigram-Index existiert. Gleiches gilt für die Artikelsuche und die Suche im E-Mail-Log über JSON-Felder.

Zusätzlich Frontend: `src/pages/Invoices.tsx` hat 3.395 Zeilen, `Lagergeraete.tsx` 2.665, `AngebotErstellen.tsx` 2.331 — große Bundles pro Route, dadurch spürbare Verzögerung beim ersten Öffnen.

## Maßnahmenplan (nach Wirkung sortiert)

### Stufe 1 — Sofortwirkung, geringes Risiko
1. **Audit-Dauerläufer stoppen/begrenzen**: Quelle identifizieren und abschalten bzw. auf inkrementelles Lesen mit Zeitfilter umstellen; `audit_logs`/`esc_audit_log` nach Aufbewahrungsfrist (z. B. 180 Tage) archivieren und leeren.
2. **RLS-Funktionsaufrufe cachen**: alle Policies auf `(SELECT funktion())`-Form umstellen, damit Postgres einmal statt pro Zeile auswertet. Betrifft vor allem `zoho_items`, `production_orders`, `lager_devices`, `offers`, `orders`, `customers`. Keine Änderung der Berechtigungslogik.
3. **Doppelte Policies zusammenfassen**: `tenant_scope_*` und Rollen-Policies je Tabelle zu einer SELECT-Policy verschmelzen (aktuell werden mehrere nacheinander geprüft).

Erwartung: Antwortzeiten großer Listen von 2–3,5 s auf deutlich unter 500 ms.

### Stufe 2 — Indizes & schlanke Abfragen
4. Trigram-Indizes für Kunden- und Artikelsuche (`pg_trgm` auf `company_name`, `contact_name`, `zoho_items.name`, `sku`).
5. Indizes für die heißen Filter: `production_orders(approval_status, status)`, `production_orders(is_reclamation)`, `orders(expected_shipment_date)`, `zoho_invoices(accounting_region, is_mietkauf, id desc)`, `route_plans(planning_status)`.
6. Zähler-Abfragen auf `count: 'exact', head: true` bzw. eine gemeinsame RPC-Funktion umstellen statt drei Einzelabfragen.
7. `raw_data` aus Listenabfragen entfernen (nur im Detail nachladen).

### Stufe 3 — Listen serverseitig
8. Rechnungen, Kunden, Artikel, Lager auf **serverseitige Pagination + Suche** umstellen (Seitengröße 50–100) statt `fetchAllPages`.
9. Einheitliches Caching über React Query mit `staleTime`, damit Tabwechsel nicht neu lädt.

### Stufe 4 — Startzeit & Suche im UI
10. Die großen Seiten (`Invoices`, `Lagergeraete`, `AngebotErstellen`, `ImportManagement`) in Unterkomponenten splitten und schwere Teile (PDF-Erzeugung, Charts, Dialoge) erst bei Bedarf laden.
11. Suchfelder durchgängig entprellen (250 ms) und serverseitig mit `limit` abfragen.
12. Virtualisiertes Rendern für Tabellen mit >200 Zeilen.

## Technische Hinweise
- Alle DB-Änderungen laufen über Migrationen; RLS-Umstellung ist rein syntaktisch (`(SELECT f())`), die Zugriffsrechte bleiben identisch.
- Indizes kosten etwas Speicher und minimal langsamere Schreibvorgänge — bei diesen Tabellengrößen vernachlässigbar.
- Nach jeder Stufe messe ich erneut über `pg_stat_statements` und das Performance Center und melde die Vorher/Nachher-Werte.

## Vorschlag
Ich beginne mit Stufe 1 und 2 (größter Hebel, kein Funktionsrisiko), messe nach und gehe dann Stufe 3 und 4 Seite für Seite an.
