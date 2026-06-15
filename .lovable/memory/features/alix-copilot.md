---
name: ALIX Copilot
description: Globaler KI-Copilot (rechts unten, ⌘J) mit Firmenwissen + Live-Tool-Calling auf Aufträge, Kunden, Finance, Tickets, Production, Repair, Sales Leads, Lager
type: feature
---
- UI: `src/components/infinity/CopilotBar.tsx` (Floating Button + Panel, Hotkey Cmd/Ctrl+J).
- Edge Function: `supabase/functions/alix-copilot/index.ts` (auth required).
- Sendet pro Anfrage: `messages`, `page` (aktuelle Route), `tenantSources` (aus TenantContext).
- Server lädt Rollen aus `user_roles` und baut Kontext-Prompt (User, Rollen, Mandant) + große Wissensbasis (Module, Mandanten, RBAC, Geschäftsregeln) auf.
- Tool-Calling-Loop (max. 6 Iterationen) gegen Lovable AI Gateway (`google/gemini-3-flash-preview`).
- Tools (read-only via Service-Role): search_orders, get_order, search_customers, get_customer, search_invoices (nur Finance/Admin), search_tickets, search_production_orders, search_repair_orders, search_sales_leads, search_lager_devices, kpi_overview.
- Frontend zeigt verwendete Tools als kleine Chips unter der Antwort.
