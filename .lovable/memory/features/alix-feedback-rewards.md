---
name: ALIX Feedback & Rewards
description: Umfrage- und Kundenfeedback-Modul unter /umfragen mit Belohnungen, E-Mail-Versand und öffentlicher Teilnahmeseite /umfrage/:token
type: feature
---
# ALIX Feedback & Rewards

- Menüpunkt **UMFRAGEN** (Top-Level, nach CUSTOMER CARE) mit Dashboard, Umfragen, Antworten, Geschenke, E-Mail-Vorlagen.
- Seiten: `src/pages/Feedback/*` (Dashboard, Surveys, SurveyEditor, Responses, Rewards, EmailTemplates), öffentliche Seite `src/pages/SurveyPublic.tsx` unter `/umfrage/:token` (kein Login, kein AppLayout).
- Tabellen: `surveys`, `survey_sections`, `survey_questions`, `survey_question_options`, `survey_logic_rules`, `survey_recipients`, `survey_invitations`, `survey_sessions`, `survey_responses`, `survey_response_items`, `survey_rewards`, `survey_reward_codes`, `survey_reward_assignments`, `survey_email_templates`, `survey_email_logs`, `survey_alerts`, `survey_ai_summaries`, `survey_testimonials`, `survey_consents`, `survey_exports`, `survey_imports`, `survey_audit_logs`.
- Edge Functions: `survey-public` (Token-Laden/Absenden, Score/NPS-Berechnung, kritische Alarme, Belohnungsvergabe) und `survey-send-invites` (Einladungen + Erinnerungen via `send-mail`, Platzhalter `{{name}} {{firma}} {{link}} {{umfrage}}`).
- Zugriff über `sv_can_read()` / `sv_can_write()`; Löschen nur Super Admin.
