---
name: ALIX CONNECT Phase 28
description: Playbook Automation Engine für Lifecycle-Stages (Health-basiert)
type: feature
---
- Edge Function: ac-playbook-run (Cron stündlich :15). Iteriert ac_customer_health, matcht enabled Playbooks per stage + min_score/max_score, throttled per (playbook_id, customer_id, throttle_days) und schreibt ac_lifecycle_runs.
- Aktionen: send_email (via send-transactional-email), send_sms (Twilio), send_whatsapp (Meta Graph), create_ticket, notify_admin (app_notifications). Templates rendern {{name}}, {{score}}, {{stage}}, {{email}}, {{phone}}, {{customer_id}}.
- Tabelle ac_lifecycle_playbooks um throttle_days, min_score, max_score erweitert.
- UI: /connect/playbooks (Admin/Super Admin) — CRUD, Dry-Run, manueller Trigger, Runs-Historie.
