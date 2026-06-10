# Project Memory

## Core
- Internal business app "Alix Work" (Orders, Customers, Route Planning, Finance).
- Dark theme, Premium Enterprise UI (Black / Gold style). Modern and clean.
- Supabase backend. NEVER create new tables; strictly use existing schema.
- Role-Based Access Control (RBAC): Admins have full access, specialists have scoped access.
- Zoho `orders.order_number` is immutable — never overwrite in DB or sync; combine only for display.
- Production-Bestellungen (inkl. Reklamationen) müssen von Super Admin genehmigt werden, bevor PDF gesendet/heruntergeladen werden kann und bevor Lieferanten sie sehen.
- Alix Austria (`source_system='zoho_eu_2'`): UI-Suffix "-AT" für Kunden- und Auftragsnummer; bei Artikeln (item_name+sku) wird "-AT" direkt beim Sync in die DB geschrieben.
- DELETE auf allen Tabellen ist ausschließlich Super Admin erlaubt (RLS via `has_role('Super Admin')`).
- Neue Rolle **QM** existiert ausschließlich für das Bug & CAPA Modul (`/bug-capa`).

## Memories
- [Access Control](mem://auth/access-control) — Internal login system without public registration, strict status checks
- [Role Permissions](mem://auth/role-permissions) — RBAC definitions for Admins and specialized roles
- [Rolle Order](mem://auth/order-role) — Breite operative Rolle: Kunden, Artikel, Verkäufe, Prio-Listen, Bestellungen, Production (ohne Factory Invoice), Lager, Tourenplanung, Versand, Finanzierungen. Kein Löschen.
- [Delete-Beschränkung Super Admin](mem://auth/delete-restriction) — Nur Super Admin darf Datensätze löschen
- [Database Constraints](mem://tech/database-constraints) — Use existing Supabase tables (user_profiles, orders, etc.). Do not create new tables.
- [Zoho Order Number](mem://constraints/zoho-order-number) — Original Zoho order_number must never be mutated
- [Dashboard](mem://features/dashboard) — Role-based KPI dashboard for core business metrics
- [Order Management](mem://features/orders) — Customer and order management rules, raw_data access restrictions
- [Route Planning](mem://features/route-planning) — Operational planning separated from master data mutations
- [Finance Management](mem://features/finance) — Financial tracking with immutable related order data
- [Import Management](mem://features/import-management) — Secure Zoho Books sync via Edge Functions
- [Bestellungs-Genehmigung](mem://features/order-approval) — Super Admin Freigabe-Workflow für production_orders mit approval_status/approved_by/approved_at
- [Alix Austria AT-Suffix](mem://features/alix-austria-at-suffix) — `-AT` Suffix Regeln für zoho_eu_2 (UI für Kunden/Aufträge, DB für Artikel)
- [System-Wartungsmodus](mem://features/system-maintenance) — Super-Admin-Schalter unter OPERATIONS; loggt alle anderen User aus und zeigt Wartungs-Overlay
- [VIP Status](mem://features/vip-status) — Goldene Krone für bevorzugte Kunden/Aufträge, automatisch Position 1 in allen Listen
- [Einkauf AT](mem://features/at-purchase) — Tab in -AT-Aufträgen für Einkaufspreis, sichtbar nur Super Admin & Rolle Österreich
- [Quellsystem-Labels](mem://design/source-system-labels) — zoho_eu_1/2 als „Alix Deutschland"🇩🇪 / „Alix Austria"🇦🇹 anzeigen
- [Rolle Österreich Sichtbarkeit](mem://auth/oesterreich-visibility) — AT-Only-Lesezugriff auf operative Module via RLS-Policies + useAtOnly() Hook
- [Bug & CAPA Modul](mem://features/bug-capa) — QM-Modul ISO 13485 unter /bug-capa, Rolle "QM", neue Tabellen bugs/capas/audit_findings/capa_actions
- [Alix Flex](mem://features/alix-flex) — Periodische Rechnungs-Stammdaten aus Zoho unter /finance/alix-flex, Tabelle zoho_recurring_profiles, Edge Function sync-zoho-recurring-profiles
- [Kundenportal](mem://features/customer-portal) — Public Statusabfrage unter /portal (Auftragsnr + PLZ + Email), Edge Function customer-portal-lookup, Admin unter /portal-admin
- [Tickets-Modul](mem://features/tickets) — /tickets, Tabellen tickets/ticket_messages/ticket_attachments/ticket_sync_logs, Inbound-Webhook alixsmart-tickets-webhook
- [Multi-Mandant](mem://features/multi-tenant) — Phase 15: tenants/user_tenant_access, TenantContext + Switcher, /mandanten + /konzern/dashboard
- [Mobile App](mem://features/mobile-app) — Phase 14: /m PWA für Techniker, Offline-Outbox (idb), dispatch_checklists/checklist_runs/signatures, Storage dispatch-mobile
- [ISO 13485 / MDR Audit Center](mem://features/iso-audit-center) — Phase 16: /iso mit Audits/Schulungen/Lieferantenbewertung/Change Control/MDR-Vigilanz, Rollen Super Admin/Admin/QM
- [Finance Phase 2 Zoho Bridge](mem://features/finance-phase2) — Edge Function sync-zoho-to-finance, Daily Cron 02:30 UTC, uniq index uq_finance_tx_reference, neue Seite /finance/raten
- [Finance Phase 3 Mahnwesen](mem://features/finance-phase3) — finance_reminders/_items, Engine-Cron 03:00 UTC erzeugt nur Entwürfe, manueller Versand via finance-reminder-send + Template finance-reminder, Einstellungen in app_settings
- [Finance Phase 4 DATEV + Bankimport](mem://features/finance-phase4) — Edge Functions finance-datev-export (EXTF 700) & finance-bank-import (CAMT.053/MT940 mit Auto-Match), neue Tabellen finance_bank_statements/_lines, Seiten /finance/datev & /finance/bank
- [Finance Phase 5 SEPA + Steuer + Cockpit](mem://features/finance-phase5) — pain.008-Lastschriften, USt-Auswertung pro Mandant, Reporting-Cockpit; neue Tabellen finance_sepa_mandates/_runs/_run_items, Edge Function finance-sepa-export, Seiten /finance/sepa, /finance/steuer, /finance/cockpit
- [Finance Phase 13 Konzern-Konsolidierung](mem://features/finance-phase13) — Monatskonsolidierung mit IC-Eliminierung + FX-Umrechnung
- [Finance Phase 14 Treasury+P2P+Meldewesen](mem://features/finance-phase14) — Bankkonten/Liquidität/Freigaben, PR→PO→Wareneingang→3-Way-Match, UStVA/ZM/OSS/Intrastat/E-Bilanz Export
