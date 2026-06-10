---
name: Finance Phase 10 KI-Analyse
description: KI-Insights, Anomalie-Erkennung, KI-Forecast, NL-Finanzabfrage via Lovable AI Gateway
type: feature
---
- Tabellen: finance_ai_insights (scope cockpit|bwa|soll_ist|forecast, prompt, response, model), finance_anomalies (source_type transaction|incoming_invoice, reason zscore_outlier|duplicate_suspect|round_large_amount, severity low|medium|high, status open|reviewed|dismissed)
- Edge Functions:
  - finance-ai-analyze – aggregiert Kennzahlen, Gemini 2.5 flash, speichert Markdown-Antwort
  - finance-anomaly-detect – statistisch (MAD/z-Score>3) + Duplikatsverdacht (supplier+date+amount). Cron 04:00 UTC empfohlen
  - finance-ai-forecast – nutzt 12-Monats-Historie, schreibt scenario='ai' in finance_forecasts (upsert auf tenant_id,period_date,category,scenario)
  - finance-ai-ask – Function-Calling mit Tools sum_revenue, list_overdue_invoices, customer_balance (read-only, kein freies SQL)
- Seiten: /finance/ai-insights, /finance/anomalien, /finance/ask; Forecast-Seite hat zusätzlich KI-Forecast-Button + Szenario "ai"
- RLS: Lesen Admin/Super Admin/Finance/Geschäftsführung; Schreiben Admin/Super Admin/Finance; DELETE nur Super Admin
- Modell: google/gemini-2.5-flash. Nutzt LOVABLE_API_KEY (bereits gesetzt).
