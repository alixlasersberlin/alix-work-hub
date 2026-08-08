---
name: Angebotsanalyse (Vertriebs-Cockpit)
description: Angebots-Analytics unter /verkauf/angebotsanalyse mit KPIs, Funnel, KI-Scoring, Forecast und Nachfass-Steuerung
type: feature
---
- Menü: SALES MANAGEMENT → ANGEBOTE → „Angebotsanalyse" (`/verkauf/angebotsanalyse`), Rollen: Super Admin, Admin, Vertrieb, Vertriebsleitung, Order, SACHBEARBEITUNG.
- Tabellen: `offers` erweitert um `stage`, `loss_reason`, `competitor`, `lead_source`, `financing_type`, `product_category`, `discount_percent`, `win_probability`, `offer_score`, `ai_probability`, `ai_reason`, `ai_actions`, `ai_scored_at`, `last_contact_at`, `next_followup_at`, `followup_note`, `expected_close_date`, `opened_at`; neue Tabelle `offer_activities` (Anruf-/Kontaktprotokoll, Delete nur Super Admin).
- Logik in `src/lib/sales/offer-analytics.ts` (KPIs, Funnel, Alter, Verkäufer-Ranking, Gruppen-Analysen, Heatmap, PLZ-Zonen, Forecast, Angebots-Score 0–100 → Hot/Warm/Cold).
- UI: `src/pages/Verkauf/Angebotsanalyse.tsx` + `src/components/sales/analyse/*` (Übersicht, Funnel, Verkäufer, Produkte, Verluste/Konkurrenz, Leads/Finanzierung, Nachfassen, KI & Forecast, Region & Zeiten, GF-Cockpit), CSV-Export.
- KI: Edge Function `offers-ai-score` (Lovable AI Gateway, `google/gemini-3-flash-preview`) schreibt Kaufwahrscheinlichkeit, Begründung und Sofortmaßnahmen zurück.
- Verkäufer = `created_by_name`; Provision im Ranking pauschal 3 %.
