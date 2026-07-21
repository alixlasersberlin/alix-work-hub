---
name: ALIX CONNECT Phase 46
description: Sales Forecast & Pipeline Intelligence — Lineare Regression aus orders, 30T Forecast, Konfidenzband, Quellsystem-Split
type: feature
---
- Route `/connect/sales-forecast` (Admin/Super Admin only, ProtectedRoute).
- Edge Function `ac-sales-forecast` (verify_jwt default, RBAC via has_role Admin/Super Admin):
  - Liest orders der letzten `lookback_days` (14–180, Default 90).
  - Aggregiert Tagesumsatz, füllt Lücken mit 0.
  - Lineare Regression y = a + b·x → Forecast über `horizon_days` (7–90, Default 30).
  - Konfidenzband ±1σ der Residuen (low/high).
  - Response: totals (past_revenue, forecast_revenue, avg_daily, trend_pct_per_day, stddev), per_source (aus source_system), series, forecast.
- UI: KPI-Tiles + ComposedChart (Ist-Linie, Forecast-Dashed, Konfidenz-Area) via recharts, Quellsystem-Tabelle mit Anteil.
- Nav-Eintrag „Sales Forecast" in Intelligence-Gruppe.
- APP_VERSION → 5.11.
