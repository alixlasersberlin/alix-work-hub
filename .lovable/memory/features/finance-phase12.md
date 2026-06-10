---
name: Finance Phase 12 - Reporting & Self-Service BI
description: Report Builder, Schedules, Management-Pack, Stakeholder-Portale unter /finance/reports, /schedules, /management-pack, /stakeholders + public /stakeholder/:token
type: feature
---
- Tabellen: `finance_reports`, `finance_report_schedules`, `finance_management_packs`, `finance_stakeholders`, `finance_stakeholder_access_logs`
- Seiten: `/finance/reports` (Builder), `/finance/schedules` (geplante Berichte), `/finance/management-pack`, `/finance/stakeholders`
- Public Portal: `/stakeholder/:token` mit Edge Function `finance-stakeholder-portal` (Token-Validierung + Access-Log)
- Edge Functions: `finance-report-run` (Aggregation), `finance-management-pack` (generate/send), `finance-stakeholder-portal`
- Zugriff: Berichte/Schedules/Pack ansehen Finance + Geschäftsführung, bearbeiten ohne Geschäftsführung; Stakeholder nur Super Admin & Geschäftsführung; Löschen nur Super Admin
