---
name: AI Service Assistent
description: AI-Modul für Service/Technik – Fehleranalyse, Ersatzteilvorschlag, Reparaturanleitung, Cockpit. Tabellen service_knowledge_base, service_ai_analyses, service_ai_repair_guides, service_ai_feedback. Edge Functions service-ai-analyze + service-ai-repair-guide. Seite /ai-service-center. Panel in TicketDetail und Reparatur/Detail.
type: feature
---
- Tabellen: `service_knowledge_base`, `service_ai_analyses`, `service_ai_repair_guides`, `service_ai_feedback`.
- Edge Functions (verify_jwt=true): `service-ai-analyze`, `service-ai-repair-guide`. Beide nutzen Lovable AI Gateway (`google/gemini-2.5-flash`).
- UI: Komponente `src/components/ai-service/AiAnalysisPanel.tsx` (Sheet mit Tabs Analyse/Teile/Anleitung/Zeit/Techniker, PDF via jsPDF client-seitig).
- Eingebunden in `TicketDetail` und `Reparatur/Detail`.
- Cockpit-Seite `/ai-service-center` (`src/pages/AiServiceCenter.tsx`) mit KPIs, Top-Ursachen, Top-Ersatzteilen, kritischen Tickets, letzten Analysen, KB-Editor.
- Rollen: Admin/Service/Technik/Kundenservice/Reparaturannahme → ausführen; Finance → nur lesen; Tourenplanung → kein Zugriff. Delete nur Super Admin.
- KB-Schreibzugriff: Admin + Technik.
- „Bestellvorschlag erzeugen" zeigt nur Hinweis, kein automatischer `production_orders`-Insert.
