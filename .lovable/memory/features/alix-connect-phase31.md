---
name: ALIX CONNECT Phase 31
description: Revenue Intelligence, AI Quality & Coaching, Omnichannel Campaigns mit A/B-Testing
type: feature
---
Phase 31 erweitert ALIX CONNECT um drei neue Module (nur Admin/Super Admin):

- `/connect/revenue-intelligence` — Pipeline & ROI-Cockpit pro Kanal/Kampagne/Journey basierend auf `ac_revenue_attributions`. Forecast 30/60/90 Tage via Edge Function `ac-revenue-forecast` (lineare Regression über tägliche Buckets).
- `/connect/quality-coaching` — 100% Auto-QA über `ac_qm_evaluations`, Agent Skill-Gaps (Ø-Score, <70%-Quote). Coaching-Empfehlungen via `ac-qm-coaching-recommend` (Lovable AI Gateway, google/gemini-3-flash-preview) legen `ac_qm_coaching_sessions` an.
- `/connect/omnichannel-campaigns` — Kampagnen-Builder für email/sms/whatsapp/voice mit A/B-Varianten (`ac_campaigns.is_ab_test`, `ab_variants`, `winner_metric`). Winner-Entscheidung via `ac-campaign-ab-decide` (open/click/reply/conversion aus `ac_campaign_recipients`).

Alle Seiten hängen in `AlixConnect/Layout.tsx` (Intelligence-Gruppe) und in `App.tsx` unter `/connect/*` als Admin-only Routes. Keine neuen Tabellen — nutzt bestehendes Schema.
