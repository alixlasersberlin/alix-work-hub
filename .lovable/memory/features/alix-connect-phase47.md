---
name: ALIX CONNECT Phase 47
description: Conversation QA & Auto-Coaching — Gemini bewertet abgeschlossene Conversations nach Score-Card, Leaderboard, Coaching-Hinweise
type: feature
---
- Neue Tabelle `ac_conversation_qa` (unique conversation_id): overall + greeting/empathy/resolution/compliance/tone Scores, strengths[], improvements[], summary, first_response_seconds, resolution_seconds. RLS: nur Admin/Super Admin lesen.
- Edge Function `ac-conversation-qa` (verify_jwt default): lädt geschlossene `ac_conversations` (Filter `since_hours`, Default 48h), zieht `ac_messages` (nur non-internal), berechnet Erst-Antwort/Lösungszeit, ruft `google/gemini-3-flash-preview` mit `response_format: json_object` und upserted Bewertung. Optional `conversation_id` für Einzelanalyse. Batch-Limit default 20.
- Seite `/connect/conversation-qa` (Admin/Super Admin): KPI-Tiles (n / Ø / Top / kritisch<60), Agent-Leaderboard (Top 10), Bewertungs-Tabelle mit Score-Ampel, Detail-Overlay mit Score-Grid + Stärken/Verbesserungen + Summary + Zeiten.
- Nav-Einträge „Sales Forecast" (Phase 46, nachgezogen) und „Conversation QA" in ALIX CONNECT.
- APP_VERSION → 5.12.
