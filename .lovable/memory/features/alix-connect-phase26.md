---
name: ALIX CONNECT Phase 26
description: Predictive CX, Proactive Outreach, Revenue Attribution — Tables, Edge Functions, Routes, Cron
type: feature
---
- Tabellen: ac_predictions (churn/escalation/nba/sentiment), ac_outreach_triggers, ac_outreach_runs, ac_revenue_attributions.
- Edge Functions: ac-predict-cx (täglich 04:00 UTC), ac-outreach-engine (stündlich :05), ac-revenue-attribution (nächtlich 03:30 UTC).
- Routen unter /connect: /predictive-cx (Admin/Super Admin/QM/Order), /outreach (Admin/Super Admin), /revenue-attribution (Admin/Super Admin).
- Attribution-Modelle: first, last, linear, time_decay (halflife 7d), position (40/20/40).
- Outreach-Events: maintenance_due, contract_expiring, warranty_ending, churn_risk, no_contact_days. Throttling pro Kunde in Tagen.
