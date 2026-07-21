---
name: ALIX CONNECT Phase 34
description: Omnichannel Orchestrator, Voice AI Studio, Revenue Intelligence 2.0
type: feature
---
Phase 34 erweitert ALIX CONNECT um drei Admin-only-Module, keine neuen Tabellen:

- `/connect/omnichannel-orchestrator` — KI wählt besten Kanal (whatsapp/email/sms/voice) je Kontakt+Kontext und plant Multi-Touch-Sequenz. Edge Function `ac-omnichannel-orchestrate` liest `ac_contacts`+`ac_messages`+`ac_calls`, schreibt Empfehlung in `ac_predictions` (kind='omnichannel_orchestration').
- `/connect/voice-ai-studio` — Outbound-Voice-Skript-Generator mit Discovery-Fragen, Einwandbehandlung, sentiment-adaptiven Closes und Voicemail-Drop. Edge Function `ac-voice-ai-studio` schreibt Skripte in `ac_predictions` (kind='voice_ai_script').
- `/connect/revenue-intel-v2` — Deal-Scoring aus Konversationen (buying signals, risk factors, coaching tips, win/loss quotes). Edge Function `ac-revenue-intel-v2` schreibt in `ac_predictions` (kind='revenue_intelligence_v2').

Alle drei Edge Functions in `supabase/config.toml` mit `verify_jwt = false`, Routen in `App.tsx` unter `/connect/*` (Admin/Super Admin), Nav-Einträge in `AlixConnect/Layout.tsx`.
