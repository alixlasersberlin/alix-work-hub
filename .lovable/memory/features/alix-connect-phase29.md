---
name: ALIX CONNECT Phase 29
description: Journey Orchestrator 2.0 — visueller Flow-Builder mit Bedingungen, Wait, A/B-Splits
type: feature
---
- Edge Function `ac-journey-run` (Cron alle 5 Min): iteriert `ac_journey_runs` mit status active/waiting und fälligem next_action_at, führt Flow-Graph pro Journey aus (max 20 Nodes/Tick).
- Node-Kinds: `trigger`, `action` (email/sms/whatsapp/webhook/tag/notify_admin), `condition` (field/op/value → yes/no branch), `wait` (minutes), `ab_split` (variants → branch), `end`.
- Graph in `ac_journeys.graph` (jsonb `{nodes,edges}`), Versionierung via `version`, A/B-Config `ab_config`.
- `ac_journey_runs` erweitert um `current_node_id`, `variant`, `path` (jsonb Verlauf).
- UI: `/connect/journey-orchestrator` (Admin/Super Admin) — Journeys CRUD, Node-Editor mit Branch-Verbindungen, Dry-Run, Engine-Trigger, manuelles Enrollment, Runs-Historie.
- Backward-kompatibel zu bestehendem linearen `ac_journey_steps` (bleibt unberührt).
