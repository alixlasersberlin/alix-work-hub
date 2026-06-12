---
name: AI Sales Wizard
description: Alix AI Sales Wizard ersetzt Zoho Forms – /beratung & /angebot öffentlich, /verkauf/neue-anfrage intern
type: feature
---
- 12-Step Wizard `src/components/SalesWizard.tsx` mit Bildkacheln in `src/assets/wizard/`.
- Routen: `/beratung` und `/angebot` (öffentlich, Turnstile), `/verkauf/neue-anfrage` (intern, AppLayout).
- Edge Function `sales-wizard-submit` (verify_jwt=false): Zod-Validierung, Turnstile-Check, Dublettencheck (email→phone→company), Lovable AI Scoring (`google/gemini-3-flash-preview`) mit Rule-Fallback, Insert in `sales_leads`, Auto-Followups in `sales_followups` (Score≥80, Videoberatung, Finance, Academy), Benachrichtigung an Vertriebs-Rollen via `mail_notifications`.
- Neue Spalten auf `sales_leads`: interests/additional_interests (jsonb), delivery_preference, consultation_type, country_code, service_rating, notes, consent_data, consent_contact, lead_score, score_category, ai_summary, ai_priority, suggested_assignee.
- Liste `/verkauf/anfragen` zeigt Score-Badge (Kalt/Warm/Heiß/Sofortkontakt), Beratungsart, Lieferzeitraum.
