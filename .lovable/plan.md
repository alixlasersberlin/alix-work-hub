# Buchhaltung CH – Eigenständiger Buchungskreis

## Ziel
Zweiter, vollständig getrennter Buchhaltungskreis „CH" neben der bestehenden „EU"-Buchhaltung. Gleiche UI, gleiche Workflows – aber Daten, RLS, Auswertungen, OP-Listen, Mahnungen und Exporte strikt getrennt.

## 1. Datenbank – `accounting_region` als harter Trenner

Neuer Enum `accounting_region` mit Werten `EU`, `CH`.

Pflichtspalte `accounting_region accounting_region NOT NULL DEFAULT 'EU'` in allen finanz-relevanten Tabellen (Backfill zuerst, dann NOT NULL):

- `orders`, `customers`
- `finance_accounts`, `finance_contracts`, `finance_transactions`, `finance_deposits`
- `finance_journal`, `finance_cashbook`, `finance_cashbook_closures`, `finance_bank_postings`
- `finance_reminders`, `finance_reminders_items`
- `finance_sepa_mandates`, `finance_sepa_runs`, `finance_sepa_run_items`
- `finance_bank_statements`, `finance_bank_lines`
- `zoho_recurring_profiles`

### Automatische Zuordnung (Backfill + Trigger)
Ein Datensatz ist `CH`, wenn eines gilt:
- Kunde: `country ILIKE 'schweiz'` / `country_code = 'CH'` / PLZ CH-Muster
- Auftrag: `source_system` liefert CH-Branch (z.B. `raw_data->>'branch_id' = '598077000000065075'`) oder verknüpfter Kunde ist CH
- Finanzobjekte erben Region vom Order/Customer via BEFORE INSERT/UPDATE Trigger `finance_set_region()`

Regel: ein Auftrag ist entweder EU oder CH – niemals beides. Trigger blockt Region-Wechsel wenn bereits gebuchte Transaktionen existieren.

### RLS
Zusätzliche RLS-Predicates auf allen betroffenen Tabellen: nur Zeilen sichtbar, deren Region der User laut Rolle sehen darf. Security-Definer-Function `has_accounting_region(uid, region)`.

### Indizes
Composite-Indizes `(accounting_region, <bestehender Sortier-/Filter-Key>)` auf allen Listen-Endpunkten (orders, transactions, journal, reminders, sepa_runs).

## 2. Rollen & Rechte

Neue App-Rollen (in `user_roles.role`-Enum ergänzen):
- `buchhaltung_eu` – Zugriff nur auf Region EU
- `buchhaltung_ch` – Zugriff nur auf Region CH
- `buchhaltung_admin` – beide Regionen

Super Admin / Admin behalten Vollzugriff. RLS-Function fragt Rollen ab, um Region-Sichtbarkeit zu bestimmen.

## 3. Anwendungs-Layer

### Region-Kontext
Neuer React-Context `AccountingRegionContext` (`src/contexts/AccountingRegionContext.tsx`):
- State: `region: 'EU' | 'CH'`, persistiert in `localStorage` (`alix.accounting.region`)
- Hook `useAccountingRegion()` liefert Region + Setter
- Erlaubte Regionen werden aus den Rollen des Users abgeleitet

### Umschalter im Menü
In `AppLayout.tsx` unter dem Menüpunkt „BUCHHALTUNG EU" wird der Eintrag zu „BUCHHALTUNG" mit Sub-Toggle:
- ○ EU
- ○ Schweiz (CH)

Auswahl setzt Region im Context und routet auf `/finance` (gleiche Routen, andere Daten). Optional URL-Query `?region=ch` für Deeplinks.

### Query-Layer
Zentrale Helper `src/lib/finance/api.ts` + `src/lib/finance/journal.ts` etc.: jeder Supabase-Query bekommt automatisch `.eq('accounting_region', region)`. Ein neuer Wrapper `withRegion(query, region)` wird konsequent überall eingesetzt.

Betroffene Seiten (jeweils regionsgefiltert):
- `Finance/Dashboard.tsx` – KPIs nur Region
- `Finance/Zahlungen.tsx`, `Zahlungsuebersicht.tsx`
- `OffenePosten.tsx`, `Gutschriften.tsx`
- `Finance/WiederkehrendeZahler.tsx`, `AlixFlex.tsx` (SEPA-Mandate)
- `Finance/Raten.tsx`, `Kassenbuch`, `Buchungsjournal`, `Bankbuchungen`, `DATEV-Export`, `Audit-Revision`
- `Finance/Reminders`, `Finance/SEPA`, `Finance/Steuer`, `Finance/Cockpit`, `Finance/Bank`

### Suchen & Statistiken
Alle Search-Endpunkte (Kunde, Rechnung, Seriennummer, Gerät, Telefon, Email, Firmenname, Auftrag) filtern nach `accounting_region`. Reports/Statistiken ebenso.

### Exporte
DATEV, CSV, Excel, PDF-Exports bekommen Region-Filter und Region im Dateinamen (`DATEV_CH_2026-01.txt`).

## 4. Zoho-Sync

Sync-Edge-Functions (`sync-zoho-*`, `sync-zoho-to-finance`, `finance-bank-import`, `finance-sepa-export`, `zoho-reconciliation`) setzen `accounting_region` beim Insert:
- `source_system = 'zoho_eu_1'` + CH-Branch → `CH`
- Kunde mit CH-Adresse → `CH`
- sonst → `EU`

Recurring-Profile / Verträge erben Region vom Kunden/Order.

## 5. UI-Kennzeichnung

- Kleiner Region-Chip (🇨🇭 CH / 🇪🇺 EU) im `PageHeader` aller Finance-Seiten.
- Farbliche Akzentuierung im Sidebar-Bereich, wenn CH aktiv (dezent, kein Redesign).
- Warnhinweis in Formularen, wenn Region-Wechsel ansteht.

## 6. Migration – Rollout in Phasen

1. **DB-Schema**: Enum + Spalten (nullable), Backfill-Skript, Trigger, Indizes.
2. **NOT NULL** setzen nach erfolgreicher Verifikation.
3. **RLS-Policies** & Rollen.
4. **Region-Context + Umschalter** im Frontend.
5. **API-Wrapper** in `src/lib/finance/*` – regionaler Filter überall.
6. **Seiten-Rollout** Finance-Modul (Dashboard, OP, Zahlungen, Mahnwesen, SEPA, Raten, Kassenbuch, Journal, DATEV, Bank, Cockpit, Steuer).
7. **Zoho-Sync-Anpassung** in Edge Functions.
8. **Exporte** & Berichte.
9. **Tests**: Cross-Region-Isolation, Sichtbarkeit pro Rolle, Backfill-Korrektheit anhand `raw_data.branch_id`.

## Technische Details

- Erweiterung, kein neues Modul: gleiche Routen `/finance/*`, Region kommt aus Context.
- Migrationen erfolgen inkrementell pro Tabellenblock, um Downtime zu vermeiden.
- Bestehende Views (`security_invoker=on`) werden um `accounting_region` erweitert.
- `finance_journal`-Trigger (`trg_cashbook_to_journal`, `trg_bankpost_to_journal`) übernehmen Region vom Quellsatz.
- `useRealtimeRefresh` bleibt unverändert – Region-Filter in Query.
- Kein Rewrite der EU-Buchhaltung; Default `EU` sichert Rückwärtskompatibilität.

## Offene Punkte / Bitte um Bestätigung

1. **CH-Erkennung Aufträge**: reicht `raw_data.branch_id = '598077000000065075'` (bestehender CH-Branch aus `OrdersCh.tsx`) als Haupt-Kriterium, oder soll zusätzlich ein neues Feld `market/verkaufsland` bei Neuanlage gepflegt werden?
2. **Bestandsdaten**: Backfill soll bestehende CH-Aufträge/-Kunden nachträglich als `CH` markieren – OK?
3. **Rollen-Zuweisung**: sollen bestehende Finance-User automatisch `buchhaltung_eu` erhalten, damit sich für sie nichts ändert?
4. **Umfang jetzt**: alles in einem Rollout, oder in Phasen (erst DB+Umschalter, dann Seite für Seite)?
