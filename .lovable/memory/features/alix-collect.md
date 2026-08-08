---
name: ALIX COLLECT
description: Intelligentes Forderungsmanagement / Mahnwesen unter /finance/collect mit KI-Risikoscoring, Mahnstufen, Sperren und Ratenplänen
type: feature
---
Modul unter `/finance/collect` (BUCHHALTUNG → MAHNUNGEN → ALIX COLLECT), Detailfall unter `/finance/collect/:caseId`.

Tabellen: `collect_cases`, `collect_case_items`, `collect_events`, `collect_stage_config`, `collect_payment_plans`, `collect_payment_plan_items`, `collect_blocks`.
Fälle werden je Kundenkonto über `collect_cases.customer_key` (Zoho-Kunden-ID, sonst Kundenname) eindeutig geführt.

DB-Funktionen (SECURITY DEFINER): `collect_sync_cases()` baut Fälle + Positionen aus `zoho_invoices` auf, setzt Mahnstufe/Ampel/Gebühren/Zinsen/Priorität und schließt Fälle ohne offene Posten. `collect_dashboard_kpis()` liefert KPIs, Aging-Buckets, DSO und Eskalationssummen.

Edge Functions:
- `collect-engine` – Cron `alix-collect-engine-daily` (06:15 UTC): Sync + Handlungsvorschläge (`collect_events.event_type='proposal'`) + automatische Sperren. Versendet NICHTS automatisch.
- `collect-send-dunning` – manueller Mahnversand per E-Mail (über `send-invoice-mail`, BCC service@alix-lasers.com, bei `cc_management` zusätzlich rde@alix-lasers.com), mit Vorschau-Modus (`preview:true`).
- `collect-ai-score` – Cron `alix-collect-ai-daily` (06:40 UTC): deterministischer Risiko-Score 0–100 + Lovable AI (google/gemini-2.5-flash) für Empfehlung/Begründung.

Zugriff: FINANCE_ROLES (Admin, Super Admin, Buchhaltung Admin/EU/CH) bzw. `can_access_finance()`; Löschen nur Super Admin. Mahnungen werden nie automatisch versendet – immer menschliche Freigabe.
