---
name: Finance Periodenabschluss & Periodensperre
description: Monats-Periodensperre je Buchungskreis (EU/CH) über finance_periods + Trigger enforce_period_lock, Seite /finance/perioden
type: feature
---

- Tabelle `finance_periods` (accounting_region, fiscal_year, period_month, status `open|soft_closed|hard_locked`, closed_at/by, reopened_at/by), UNIQUE (region, year, month)
- Trigger `enforce_period_lock()` auf `finance_transactions`, `finance_journal`, `finance_cashbook`, `finance_bank_postings`: blockt INSERT/UPDATE/DELETE, wenn Periode geschlossen — außer Super Admin
- Seite `/finance/perioden` (Perioden­abschluss & Sperre): 12-Monats-Matrix mit Buchungsstatistik (Anzahl, Netto, Brutto), CSV-Export `Periodenabschluss_<Jahr>_<Region>.csv`; Wiedereröffnen nur Super Admin
- Rollen: FINANCE_ROLES in App.tsx umfasst jetzt Admin, Super Admin, Buchhaltung Admin, Buchhaltung EU, Buchhaltung CH (Datenzugriff via RLS `has_finance_region_access`)
- Region-Erkennung zentral in `src/lib/finance/region.ts` (`detectAccountingRegion`, `regionCurrency`, `regionFileName`, CH_BRANCH_ID) + Tests; gleiche Logik in Edge Function `sync-zoho-to-finance`
- `RegionChip` (src/components/finance/RegionChip.tsx) wird global im Header auf allen `/finance`-Routen angezeigt
