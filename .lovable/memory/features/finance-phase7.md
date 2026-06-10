---
name: Finance Phase 7
description: Anlagenbuchhaltung (finance_assets/_depreciations) und Liquiditätsplanung (finance_cashflow_plans/_items) mit AfA-Engine und 12-Monats-Cashflow-Forecast
type: feature
---
# Finance Phase 7 – Anlagenbuchhaltung & Liquiditätsplanung

## Tabellen
- `finance_assets` – Anlagegüter (Inv.-Nr. `ANL-YYYY-00001`), AfA-Methoden: linear / gwg_sofort / gwg_pool / degressiv, Restbuchwert
- `finance_asset_depreciations` – monatliche AfA-Buchungen, eindeutig pro (asset_id, period)
- `finance_cashflow_plans` – Plan-Header (12 Monate Zeitraum, Startsaldo, Mandant)
- `finance_cashflow_items` – Plan-/Ist-Positionen je Monat, Quellen: manuell, auto_zoho, auto_recurring, auto_sepa, auto_incoming, auto_afa, auto_bank

## Edge Function
- `finance-asset-depreciation-run` – Body: `{ period: "YYYY-MM", dry_run: bool }`. Berechnet AfA, optional Verbuchung in `finance_asset_depreciations` + Update von `book_value` / `accumulated_depreciation`.

## UI
- `/finance/anlagen` – Liste + Anlegen/Bearbeiten/Abgang
- `/finance/anlagen/afa-lauf` – Vorschau und Verbuchung
- `/finance/liquiditaet` – Plan auswählen, Auto-Befüllen aus Zoho/Eingangsrechnungen/AfA, 12-Monats-Tabelle + Bar/Line-Chart, CSV-Export, Ampel bei Unterdeckung

## RBAC
- Lesen: Finance, Admin, Super Admin, Geschäftsführung
- Anlegen/Bearbeiten/AfA-Lauf: Finance, Admin, Super Admin
- Löschen: nur Super Admin
