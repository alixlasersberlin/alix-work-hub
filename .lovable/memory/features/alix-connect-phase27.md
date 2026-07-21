---
name: ALIX CONNECT Phase 27
description: Conversational AI Studio, Voice Analytics & Speech Intelligence, Customer Health & Lifecycle
type: feature
---
- Tabellen: ac_bot_intents, ac_bot_flows, ac_bot_training_log, ac_voice_insights, ac_voice_compliance_rules, ac_customer_health, ac_lifecycle_playbooks, ac_lifecycle_runs.
- Edge Functions: ac-voice-analyze (stündlich :15, Keywords/Topics/Compliance/Talk-Ratio), ac-health-score (täglich 04:30 UTC, 0-100 Score + Lifecycle-Stage).
- Routen unter /connect: /bot-studio (Admin/Super Admin), /voice-analytics (Admin/Super Admin/QM), /customer-health (Admin/Super Admin/Order/QM).
- Health-Formel: usage 35% + payment 25% + support 20% + sentiment 20%. Lifecycle: onboarding/adopt/expand/renew/risk/churned.
- Bot Studio hat Live-Trainer: neue Utterances landen in ac_bot_training_log und werden zu training_phrases hinzugefügt.
