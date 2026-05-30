## Ziel

Die Rolle **Österreich** erhält Sichtbarkeit auf die Menüs **KUNDEN, ARTIKEL, VERKÄUFE, PRIO-LISTEN, BESTELLUNGEN, LAGERBESTAND, TOURENPLANUNG, VERSAND, HILFE** — sieht dort aber **ausschließlich Datensätze mit Bezug zu Alix Austria** (`source_system='zoho_eu_2'`, d. h. mit -AT-Suffix). Schreibrechte für andere Rollen bleiben unverändert; Österreich bleibt grundsätzlich Read-Only (außer wo bereits explizit anders festgelegt).

## 1. Sidebar (AppLayout.tsx)

Die Rolle `'Österreich'` wird in den `roles`-Arrays folgender Top-Level-Gruppen und passender Kinder ergänzt:
- KUNDEN, ARTIKEL, VERKÄUFE, PRIO-LISTEN, BESTELLUNGEN, LAGERBESTAND, TOURENPLANUNG, VERSAND, HILFE
- Nicht ergänzt: OPERATIONS, FINANZIERUNGEN, FINANCE, ADMIN-Bereiche

## 2. RLS-Erweiterungen (Migration)

Neue SECURITY DEFINER-Funktion:
```
public.is_at_role() → bool   -- has_role('Österreich')
```

Pro Tabelle eine zusätzliche **permissive SELECT-Policy**, die nur AT-Datensätze freigibt:

| Tabelle | AT-Filter |
|---|---|
| `orders` | `source_system = 'zoho_eu_2'` |
| `order_items` | via `order_id → orders.source_system = 'zoho_eu_2'` |
| `order_notes`, `order_status_history`, `order_documents`, `order_additional_deposits` | via `order_id → orders` |
| `customers` | `source_system = 'zoho_eu_2'` |
| `production_orders`, `production_order_items` | via `order_id → orders` |
| `lager_devices` | via `reserved_order_id → orders` ODER alle Geräte (zu klären — siehe offene Frage) |
| `finance_records`, `bank_financing_requests` | **kein** Zugriff für Österreich |

Bestehende Policies bleiben unverändert (Admin/Order/etc. behalten ihre Rechte). Da Policies OR-verknüpft sind, fügt Österreich nur seine AT-Sicht hinzu, ohne andere Rollen einzuschränken.

## 3. UI-Filter

Damit Admins eine unveränderte Vollsicht behalten und Österreich automatisch nur AT sieht, wird ein zentraler Helper genutzt:

```
useAtOnly() → boolean   // hasRole('Österreich') && !isAdmin
```

In folgenden Listen wird bei `useAtOnly === true` ein zusätzlicher Filter `source_system='zoho_eu_2'` an die Supabase-Query gehängt bzw. Region-Filter fest auf 'at' gesetzt und der Region-Selector ausgeblendet:

- `Orders.tsx`, `OrdersInClarification.tsx`, `OrdersFreiBestellung.tsx`
- `PriorityList.tsx`, `HoldList.tsx`, `DeliveredList.tsx`, `PartialDeliveryList.tsx`
- `ProductionOrders.tsx` (auch Reklamation), Versand-Listen
- `Customers`-Liste, `Artikel`-Liste
- `RoutePlanning`-Übersicht
- `Lagergeraete.tsx` (nur reservierte AT-Geräte + unreservierte mit AT-Modell? — siehe offene Frage)

## 4. Detail-Seiten

Die Detail-Routen (`/auftraege/:id`, `/kunden/:id` …) werden nicht extra gesperrt — die RLS verhindert ohnehin das Laden nicht-AT-Datensätze für Österreich.

## Offene Punkte (kurze Bestätigung nötig)

1. **LAGERBESTAND**: Soll Österreich nur Geräte sehen, die einem -AT-Auftrag reserviert sind, oder alle freien Geräte plus AT-Reservierungen?
2. **BESTELLUNGEN (production_orders)**: Reine Leseansicht für Österreich auch für nicht von ihm erstellte Bestellungen?
3. **HILFE**: Hier vermutlich keine Filterung nötig — sichtbar wie für alle?

Sobald du diese drei Punkte bestätigst, setze ich Migration + UI in einem Rutsch um.
