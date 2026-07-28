---
name: Social Media Module
description: Social Media Onboarding, Content, KI, Analytics, Publishing unter /social/*, Tabellen social_* inkl. social_post_metrics & social_publish_jobs
type: feature
---
- Modul unter /social/*; sichtbar Super Admin, Admin, Marketing, Grafiker.
- Phase 1 Fundament: 14 Tabellen (social_clients, social_accounts, social_credentials AES-256, social_media_library, ...).
- Phase 2 Content: BeitragEditor, Kalender, Freigaben, Medien (Storage bucket social-media-library).
- Phase 3 KI: Edge Function `social-ai-generate` (action=caption Gemini, action=image gpt-image-2).
- Phase 4 Analytics + Publishing:
  - Tabellen: `social_post_metrics` (impressions/reach/likes/comments/shares/clicks/saves/engagement_rate, unique post_id+metric_date), `social_publish_jobs` (queued/running/done/failed/cancelled, Retries mit Backoff, external_post_id/url).
  - Edge Function `social-publish`: actions enqueue | run_now | cancel | process_due. Provider-Upload aktuell Stub (`publishToProvider`), simuliert external_url. Setzt Post-Status auf published/scheduled, legt Initial-Metric an.
  - Edge Function `social-metrics-sync`: aktualisiert Kennzahlen für published Posts (aktuell deterministischer Stub `fakeMetrics`, seeded per Post+Datum+Plattform).
  - Cron: `social-publish-process-due` alle 5 Min, `social-metrics-daily-sync` täglich 03:15 UTC.
  - Seiten: /social/analytics (KPIs, Plattform-Breakdown, Top 10 Posts), /social/veroeffentlichung (Queue-Manager mit Jetzt/Abbrechen/Fällige verarbeiten).
  - Editor: neuer Button „Veröffentlichung planen" ruft `social-publish` action=enqueue.
- Schreiben auf metrics/jobs nur wenn `can_admin_social()` true; Lesen für alle Social-Rollen.
