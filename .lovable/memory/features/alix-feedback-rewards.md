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

## Umfrage-Designer
- `surveys.design` (jsonb) speichert das komplette Erscheinungsbild; Vorlagen in `survey_design_templates`; Medien im privaten Bucket `survey-media` (anon lesbar via RLS, Zugriff über signierte URLs).
- Code: `src/lib/feedback/design.ts` (Typen, 8 Themes, Layouts, Fonts, Token-Mapping), `src/lib/feedback/media.ts` (Upload/Mediathek), `src/pages/Feedback/SurveyDesignTab.tsx` (Designer + Live-Vorschau), Anwendung in `src/pages/SurveyPublic.tsx`.
- Einstellbar: Theme, Layout (Karte/Vollbild/Split/Minimal/Chat), Farben, Schrift, Radius/Schatten, Hintergrund (Farbe/Verlauf/Bild), Logo/Titelbild, Fortschritt (Balken/Punkte/Schritte/aus), Animation, eine Frage pro Seite, Startseite, Personalisierung ({{name}}/{{firma}}/{{umfrage}}), Fußzeile/DSGVO-Links.

## Fragen-Logik
- Tab **Logik** im Umfrage-Editor (`src/pages/Feedback/SurveyLogicTab.tsx`) verwaltet `survey_logic_rules`.
- Operatoren: eq, ne, gt, gte, lt, lte, contains, answered, not_answered. Aktionen: show, hide, jump (dazwischenliegende Fragen überspringen), end (vorzeitig beenden).
- Auswertung in `src/lib/feedback/logic.ts` (`applyLogic`), live angewendet in `SurveyPublic.tsx`; `survey-public` liefert aktive Regeln im `load`-Payload mit.
