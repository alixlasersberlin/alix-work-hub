---
name: ALIX CONNECT Phase 33
description: Agent Assist Live 2.0, Customer Intelligence Hub, Autonomous Service Agents
type: feature
---
Phase 33 erweitert ALIX CONNECT um drei Admin-only-Module, keine neuen Tabellen:

- `/connect/agent-assist-live` — Echtzeit-Copilot pro Konversation: next reply, tone, sentiment, urgency, KB-Snippet. Edge Function `ac-agent-assist-live` liest `ac_messages` (direction=inbound/outbound), holt KB aus `service_knowledge_base` und persistiert in `ac_copilot_suggestions`.
- `/connect/customer-intelligence` — Churn/CLV/Segment/Next-Best-Offer/Cross-Sell auf Basis `ac_contacts` + `ac_messages` + `ac_calls`. Edge Function `ac-customer-intel` schreibt Predictions in `ac_predictions` (kind='customer_intelligence', payload) und upserted `ac_customer_health` (score, factors) für zugeordnete `customer_id`.
- `/connect/autonomous-agents` — AI-Agenten schlagen Ticket-Auflösungen vor und führen sie bei confidence ≥ 0.85 im Auto-Modus aus (send_reply → `ticket_messages`, set_status/close_ticket/assign → `tickets`). Edge Function `ac-autonomous-resolve` protokolliert alles in `ac_copilot_actions` (params/result).

Alle drei Edge Functions in `supabase/config.toml` mit `verify_jwt = false` registriert; Routen in `App.tsx` unter `/connect/*` (Admin/Super Admin) und Nav-Einträge in `AlixConnect/Layout.tsx`. Ticket-Close nutzt `resolved_at` (kein `closed_at`-Feld).
