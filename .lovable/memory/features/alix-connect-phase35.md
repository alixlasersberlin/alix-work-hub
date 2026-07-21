---
name: ALIX CONNECT Phase 35
description: Predictive Engagement, Knowledge Graph & RAG 2.0, Multilingual Real-Time Translation
type: feature
---
Phase 35 fügt drei Admin-only-Module hinzu, keine neuen Tabellen:

- `/connect/predictive-engagement` — KI sagt Best-Time-to-Contact, Response-Wahrscheinlichkeit und Churn-Risiko pro Kontakt voraus, inkl. Proactive-Outreach-Vorschlag. Edge Function `ac-predictive-engagement` liest `ac_contacts`+`ac_messages`+`ac_calls`, schreibt Ergebnis in `ac_predictions` (kind='predictive_engagement').
- `/connect/knowledge-rag` — Enterprise Knowledge Graph mit RAG-Antworten über `ac_messages`, `tickets`, `alixdocs_documents`. Edge Function `ac-knowledge-rag` liefert zitierte Antwort + related_entities; loggt bei contact_id in `ac_predictions` (kind='knowledge_rag_query').
- `/connect/translation-hub` — Live-Übersetzung in 30+ Sprachen mit Tonalität + Fach-Domain. Edge Function `ac-translate-live`, optionales Logging in `ac_predictions` (kind='live_translation').

Alle drei Edge Functions in `supabase/config.toml` mit `verify_jwt = false`, Routen in `App.tsx` unter `/connect/*` (Admin/Super Admin), Nav-Einträge in `AlixConnect/Layout.tsx`.
