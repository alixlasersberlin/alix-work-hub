---
name: Finance Phase 9 Controlling
description: Budget, Soll-Ist-Vergleich, Rolling Forecast, Controlling-Cockpit mit KPIs
type: feature
---
- Tabellen: finance_budgets (tenant_id, fiscal_year, month, category, planned_amount; UNIQUE(tenant_id,fiscal_year,month,category)), finance_forecasts (tenant_id, period_date, category, scenario base|best|worst, forecast_amount; UNIQUE(tenant_id,period_date,category,scenario))
- Seiten:
  - /finance/budget – Editor pro Mandant/Jahr, Kopierfunktion "Aus Vorjahres-Ist" befüllt aus finance_transactions + finance_incoming_invoices
  - /finance/soll-ist – Plan vs. Ist je Kategorie/Monat mit Ampel (grün <10%, gelb <20%, rot >=20% Abweichung)
  - /finance/forecast – 3 Szenarien (base/best±15%/worst-15%), Auto-Init aus 3-Monats-Schnitt Ist, Linien-Chart Umsatz Ist vs. Forecast
  - /finance/controlling – KPIs 12 Monate rollierend: Umsatzrentabilität, DSO, DPO, Working Capital, Burn Rate, Runway + Trend-Chart
- Kategorien fix definiert in src/pages/Finance/_controlling.ts: Umsatz, Wareneinkauf, Personal, Miete, Marketing, AfA, Zinsen, Sonstige Aufwendungen
- Ist-Klassifikation: finance_transactions.transaction_type via classifyTx, finance_incoming_invoices.description via mapIncomingCategory (Heuristik, weil keine category-Spalte existiert)
- RLS: Lesen Admin/Super Admin/Finance/Geschäftsführung; Bearbeiten Admin/Super Admin/Finance; DELETE nur Super Admin
- WICHTIG: finance_incoming_invoices nutzt amount_gross/amount_net (NICHT total_amount/net_amount), paid_at (NICHT payment_status), description (es gibt keine category-Spalte)
