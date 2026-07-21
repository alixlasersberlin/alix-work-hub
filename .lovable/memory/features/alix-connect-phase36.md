---
name: ALIX CONNECT Phase 36
description: Sentiment & Emotion AI 2.0, Workflow Automation Studio, Compliance & Governance Cockpit
type: feature
---
Phase 36 (Full Rollout):
- Sentiment & Emotion AI 2.0 — /connect/sentiment-emotion, Edge Function `ac-sentiment-emotion` (Gemini 3 Flash JSON: sentiment/score, primary+secondary emotions, escalation flag, empathy coaching, compliance flags). Logs to `ac_predictions` (kind='sentiment_emotion').
- Workflow Automation Studio — /connect/workflow-studio, Edge Function `ac-workflow-studio` mit ops `validate`, `generate` (AI), `save` (schreibt in `ac_automation_rules` als Entwurf, `metadata.full_flow`).
- Compliance & Governance Cockpit — /connect/compliance-governance, Edge Function `ac-compliance-governance` mit ops `redact` (Regex-PII: email/phone/iban/cc/ipv4/tax_id/postal), `audit` (Snapshot ac_calls/ac_conversations + Retention), `log` (kind='compliance_scan').
Routen restricted auf Admin/Super Admin. Nav-Einträge in AlixConnect Layout Intelligence-Gruppe.
