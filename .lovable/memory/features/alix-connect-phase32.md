---
name: ALIX CONNECT Phase 32
description: Conversational Intelligence 2.0, Journey AI-Optimizer, Unified Agent Workspace
type: feature
---
Phase 32 erweitert ALIX CONNECT um drei neue Module (nur Admin/Super Admin), keine neuen Tabellen:

- `/connect/conv-intel` — Deep Speech Analytics: Topic-Detection, Talk/Listen-Ratio, Silence-Share, DSGVO/Recording-Compliance-Checks über alle Anrufe. Edge Function `ac-conv-intel-analyze` liest `ac_calls.transcript`, prüft gegen `ac_voice_compliance_rules` und schreibt Ergebnisse in `ac_voice_insights` (Gemini via Lovable AI Gateway).
- `/connect/journey-optimizer` — Analysiert Drop-offs pro Schritt aus `ac_journey_runs`, ermittelt Worst-Step und generiert deutsche Coaching-/A-B-Empfehlungen via Edge Function `ac-journey-optimize`.
- `/connect/workspace` — Unified Agent Workspace: 3-Spalten-Ansicht (aktive Calls · Transcript+Summary · Customer 360°/Copilot-Suggestions/KB-Suche) für Live-Bearbeitung. Nutzt `ac_calls`, `ac_contacts`, `ac_copilot_suggestions`, `ac_kb_articles`.

Neue Routen in `App.tsx` unter `/connect/*` (Admin-only) und Nav-Einträge in `AlixConnect/Layout.tsx` (Intelligence-Gruppe). Edge Functions registriert in `supabase/config.toml` mit `verify_jwt = false`.
