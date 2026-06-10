---
name: Finance Phase 13 — Konzern-Konsolidierung & Intercompany
description: Monatskonsolidierung über alle Mandanten mit Intercompany-Eliminierung und FX-Umrechnung. Neue Tabellen finance_consolidation_runs/_items, finance_intercompany_relations/_matches, finance_fx_rates. Edge Function finance-consolidation-run. Seiten /finance/konsolidierung, /finance/intercompany, /finance/fx.
type: feature
---

## Tabellen
- `finance_consolidation_runs` (period_month, status, totals jsonb, gross/eliminated/consolidated_total)
- `finance_consolidation_items` (run_id, tenant_id, transaction_type, gross/eliminated/consolidated_amount)
- `finance_intercompany_relations` (source_tenant_id, target_tenant_id, label, active) — UNIQUE Paar
- `finance_intercompany_matches` (source_tx_id, target_tx_id, amount, currency) — Eliminierungspaar
- `finance_fx_rates` (currency, rate_date, rate_to_eur, source) — UNIQUE (currency, rate_date)

Additiv auf `finance_transactions`: `tenant_id`, `counterparty_tenant_id`, `is_intercompany` (default false).

## Edge Function
`finance-consolidation-run` (POST, JWT required, Rollen Super Admin/Admin/GF/Finance):
- Body: `{ period_month: "YYYY-MM", notes?: string }`
- Aggregiert finance_transactions je tenant+transaction_type in EUR (FX über `finance_fx_rates`, EUR=1)
- Eliminiert Beträge wenn `is_intercompany=true` oder Transaktion in `finance_intercompany_matches` referenziert
- Idempotent: löscht zuvor vorhandenen Run für dieselbe Periode
- Persistiert `finance_consolidation_runs` + `finance_consolidation_items`

## UI
- `/finance/konsolidierung` — Lauf-Liste + Periodenwahl, Trigger
- `/finance/konsolidierung/:id` — Brutto / Eliminiert / Konsolidiert je Mandant + Buchungsart
- `/finance/intercompany` — Beziehungsmatrix + Liste IC-markierter Buchungen
- `/finance/fx` — CRUD Devisenkurse

## RBAC
- Lesen: Super Admin, Admin, Geschäftsführung, Finance
- Bearbeiten: Super Admin, Admin, Geschäftsführung (Insert via Finance erlaubt für Matches/FX/Runs)
- Löschen: ausschließlich Super Admin
