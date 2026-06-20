// ALIX Copilot – Tool-calling Chat Endpoint
// Erweitert den bisherigen ai-center-chat um Firmen-Wissensbasis und
// Live-Tools (read-only) auf die wichtigsten Module von Alix Work.
//
// Sicherheit:
//  - Authentifizierter Nutzer erforderlich (JWT via Authorization-Header).
//  - Tools führen ausschließlich SELECT-Queries via Service-Role aus.
//  - RBAC: bestimmte Tools (z.B. Finance/AT-Einkauf) nur für entsprechende Rollen.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const KNOWLEDGE = `Du bist ALIX, der KI-Copilot von „Alix Work" (AlixSmart Infinity OS), einem internen Business-System der Alix Lasers Gruppe.

# Firma & Mandanten
- Alix Deutschland (source_system='zoho_eu_1') 🇩🇪 und Alix Austria (source_system='zoho_eu_2') 🇦🇹.
- AT-Mandant: Kunden- und Auftragsnummern bekommen in der UI das Suffix "-AT". Bei Artikeln (item_name/sku) ist "-AT" direkt in der DB gespeichert.
- Multi-Mandant: Tabelle 'tenants', Zugriff über 'user_tenant_access'.

# Module
- Verkauf / Sales Leads (sales_leads, sales_followups) – AI Sales Wizard /beratung & /angebot.
- Kunden (customers, customer_notes, customer_communication_log).
- Aufträge (orders, order_items, order_status_history, order_notes, order_at_purchase, order_at_approval).
- Production (production_orders, production_order_items) – Reklamationen & Bestellungen, Super Admin Freigabe nötig vor PDF/Lieferant.
- Reparatur (repair_orders, repair_quotes, repair_parts, repair_invoice_proposals).
- Lager (lager_devices) – Geräte mit Seriennummer, Status, Standort.
- Tickets (tickets, ticket_messages) – Support-Kanäle, AlixSmart Webhook.
- Tourenplanung (route_plans) – Versand-Touren mit Mitarbeitern und Fahrtzeiten.
- Finance: Rechnungen (finance_records, zoho_invoices, zoho_unpaid_invoices), Mahnwesen (finance_reminders), Bankimport (finance_bank_*), DATEV-Export, SEPA (finance_sepa_*), Konsolidierung, Cashflow, Assets.
- ISO 13485 / MDR (iso_audits, iso_change_controls, mdr_vigilance_reports, iso_trainings).
- Bug & CAPA (bugs, capas, capa_actions, audit_findings) – Rolle "QM".
- Mobile PWA für Techniker unter /m mit Offline-Outbox.

# Rollen (RBAC)
- Super Admin: Vollzugriff, einzige Rolle die löschen darf, genehmigt Production-Bestellungen.
- Admin, Order, Finance, Service, Tourenplanung, Österreich (AT-only Lesezugriff), QM (nur Bug & CAPA).

# Geschäftsregeln
- orders.order_number ist immutable – nie überschreiben.
- AT-Aufträge zeigen "-AT" nur in der UI (Kunden/Aufträge); bei Artikeln steht "-AT" schon in der DB.
- Production-Bestellungen brauchen Super-Admin-Freigabe (approval_status).
- VIP-Kunden/Aufträge bekommen eine goldene Krone und sind immer Position 1.
- Wartungsmodus kann Super Admin aktivieren; sperrt andere Nutzer.

# Stil
Antworte auf Deutsch, präzise, mit Listen oder kurzen Tabellen falls hilfreich.
Wenn du Echtdaten brauchst, nutze deine Tools.
Spezialisierte Tools: search_orders, get_order, search_customers, get_customer, search_invoices, search_tickets, search_production_orders, search_repair_orders, search_sales_leads, search_lager_devices, kpi_overview.
Universelle Tools (für ALLE anderen Module wie Finance, ISO 13485, MDR, QM/Bugs/CAPA, Mail, WhatsApp, Tourenplanung, Warranty, Maintenance, Lieferanten, Dispatch, Lager, Reviews, Academy, AI-Service, Device-Lifecycle, Stammdaten usw.):
  • list_modules() – Übersicht aller verfügbaren Tabellen mit Modul-Gruppierung
  • describe_table(table) – Spalten einer Tabelle anzeigen (vor query_table aufrufen, wenn Struktur unbekannt)
  • query_table(table, search?, filters?, order_by?, ascending?, limit?) – generische SELECT-Abfrage
Vorgehen: Wenn der Nutzer eine Frage zu einem Modul stellt, das kein spezielles Tool hat → erst list_modules oder describe_table, dann query_table mit passenden Filtern.
Wenn ein Tool 0 Treffer liefert, sage das offen und schlage einen anderen Filter vor.
Niemals erfundene Zahlen, Auftragsnummern, Beträge oder Kunden.`;

// ---------- Tool Definitionen ----------
const tools = [
  {
    type: "function",
    function: {
      name: "search_orders",
      description: "Suche Aufträge nach Volltext (Auftragsnr., Kundenname). Optional Status/Quellsystem.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Suchbegriff (Auftragsnr., Kundenname, PLZ…)" },
          status: { type: "string" },
          source_system: { type: "string", enum: ["zoho_eu_1", "zoho_eu_2"] },
          limit: { type: "number", default: 20 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_order",
      description: "Hole einen einzelnen Auftrag inkl. Positionen.",
      parameters: { type: "object", properties: { order_number: { type: "string" } }, required: ["order_number"] },
    },
  },
  {
    type: "function",
    function: {
      name: "search_customers",
      description: "Kunden nach Name, E-Mail, Telefon, Kundennummer suchen.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" }, limit: { type: "number", default: 20 } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_customer",
      description: "Kunde mit Aufträgen + offenen Rechnungen holen.",
      parameters: {
        type: "object",
        properties: { customer_number: { type: "string" } },
        required: ["customer_number"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_invoices",
      description: "Zoho-Rechnungen suchen. Filter: query, status (paid/unpaid/overdue), source_system.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          status: { type: "string" },
          source_system: { type: "string" },
          limit: { type: "number", default: 20 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_tickets",
      description: "Support-Tickets suchen.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          status: { type: "string" },
          limit: { type: "number", default: 20 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_production_orders",
      description: "Produktions-/Reklamationsbestellungen suchen.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          status: { type: "string" },
          approval_status: { type: "string" },
          limit: { type: "number", default: 20 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_repair_orders",
      description: "Reparaturaufträge suchen.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          status: { type: "string" },
          limit: { type: "number", default: 20 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_sales_leads",
      description: "Vertriebs-Anfragen (Sales Leads) suchen.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          score_category: { type: "string" },
          limit: { type: "number", default: 20 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_lager_devices",
      description: "Lager-Geräte (Seriennummer, Modell, Status, Standort) suchen.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" }, status: { type: "string" }, limit: { type: "number", default: 20 } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "kpi_overview",
      description: "Aktuelle Kennzahlen: Anzahl offene Aufträge, offene Tickets, überfällige Rechnungen, neue Leads (7 Tage).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_modules",
      description: "Listet alle verfügbaren Tabellen/Module, die per query_table abgefragt werden können – gruppiert nach Bereich (Finance, ISO, QM, Mail, WhatsApp, Service, Lager, Tourenplanung, Stammdaten, …). Nutze dies, wenn der Nutzer eine Frage zu einem Modul ohne dediziertes Tool stellt.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "describe_table",
      description: "Zeigt die Spalten (Name + Typ) einer Tabelle aus dem public-Schema.",
      parameters: {
        type: "object",
        properties: { table: { type: "string" } },
        required: ["table"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_table",
      description: "Generische read-only SELECT-Abfrage auf eine erlaubte Tabelle. Unterstützt Filter (eq/neq/ilike/gt/gte/lt/lte/in/is) und Sortierung. Nutze dies für alle Module ohne dediziertes Tool (Finance, ISO, QM, Mail, WhatsApp, Tourenplanung, Warranty, Maintenance, Suppliers, Device-Lifecycle, Sales-Followups, MDR …).",
      parameters: {
        type: "object",
        properties: {
          table: { type: "string" },
          search: {
            type: "object",
            description: "Optionale Volltextsuche: { columns: ['col1','col2'], term: 'foo' }",
            properties: {
              columns: { type: "array", items: { type: "string" } },
              term: { type: "string" },
            },
          },
          filters: {
            type: "array",
            description: "Liste von Filtern, z.B. [{column:'status',op:'eq',value:'open'}].",
            items: {
              type: "object",
              properties: {
                column: { type: "string" },
                op: { type: "string", enum: ["eq", "neq", "ilike", "gt", "gte", "lt", "lte", "in", "is"] },
                value: {},
              },
              required: ["column", "op"],
            },
          },
          select: { type: "string", description: "Spaltenliste (Default '*')." },
          order_by: { type: "string" },
          ascending: { type: "boolean", default: false },
          limit: { type: "number", default: 20 },
        },
        required: ["table"],
      },
    },
  },
];

// ---------- Tabellen-Allowlist / Modulkatalog ----------
const BLOCKED_TABLES = new Set<string>([
  "user_profiles", "user_roles", "roles", "user_invitations", "login_sessions",
  "otp_challenges", "api_rate_limits", "audit_logs", "mail_audit_logs",
  "customer_portal_users", "mobile_push_subscriptions", "backups_metadata",
  "alix_sign_audit_log", "alix_sign_signatures", "alix_sign_requests",
  "finance_stakeholder_access_logs", "email_unsubscribe_tokens",
  "alixsmart_migration_logs", "alixsmart_migration_map", "migration_backup_logs",
  "system_maintenance",
]);

const MODULE_CATALOG: Record<string, string[]> = {
  "Stammdaten": ["customers", "customer_notes", "customer_communication_log", "suppliers", "departments", "tenants", "user_tenant_access", "number_ranges", "product_categories", "item_category_assignments"],
  "Verkauf / Leads": ["sales_leads", "sales_followups", "sales_lead_history", "offers", "reviews", "review_email_logs"],
  "Aufträge": ["orders", "order_items", "order_status_history", "order_notes", "order_documents", "order_at_purchase", "order_at_approval", "order_additional_deposits", "order_import_logs", "deleted_customers"],
  "Production": ["production_orders", "production_order_items"],
  "Reparatur": ["repair_orders", "repair_quotes", "repair_quote_items", "repair_quote_history", "repair_parts", "repair_spare_parts", "repair_communications", "repair_status_history", "repair_invoice_proposals", "repair_signatures", "repair_attachments", "repair_work_orders", "repair_delivery_handover", "repair_finance_handover", "repair_workshop_intake"],
  "Lager / Geräte": ["lager_devices", "loaner_device_assignments", "device_lifecycle", "device_health_scores", "device_maintenance", "model_manuals", "support_videos", "technician_stock", "technician_stock_movements", "technician_skills"],
  "Tickets / Support": ["tickets", "ticket_messages", "ticket_attachments", "ticket_category_rules", "ticket_sync_logs", "ticket_sync_alerts", "ticket_outbound_sync_logs", "customer_portal_tickets", "customer_portal_ticket_messages", "customer_portal_quote_responses", "customer_portal_document_downloads"],
  "Tourenplanung / Dispatch": ["route_plans", "dispatch_vehicles", "dispatch_checklists", "dispatch_checklist_runs", "dispatch_used_parts", "dispatch_signatures", "dispatch_attachments"],
  "Finance": ["finance_records", "finance_transactions", "finance_accounts", "finance_bank_accounts", "finance_bank_statements", "finance_bank_lines", "finance_reminders", "finance_reminder_items", "finance_sepa_mandates", "finance_sepa_runs", "finance_sepa_run_items", "finance_tax_filings", "finance_tax_filing_lines", "finance_assets", "finance_asset_depreciations", "finance_budgets", "finance_forecasts", "finance_cashflow_plans", "finance_cashflow_items", "finance_liquidity_entries", "finance_documents", "finance_contracts", "finance_incoming_invoices", "finance_purchase_orders", "finance_purchase_order_items", "finance_purchase_requisitions", "finance_purchase_requisition_items", "finance_goods_receipts", "finance_three_way_matches", "finance_payment_approvals", "finance_approvals", "finance_anomalies", "finance_ai_insights", "finance_intercompany_relations", "finance_intercompany_matches", "finance_consolidation_runs", "finance_consolidation_items", "finance_year_end_runs", "finance_reports", "finance_report_schedules", "finance_management_packs", "finance_fx_rates", "finance_automations", "finance_automation_runs", "finance_stakeholders", "finance_history", "bank_financing_requests"],
  "Zoho": ["zoho_invoices", "zoho_unpaid_invoices", "zoho_items", "zoho_recurring_invoices", "zoho_recurring_profiles", "goods_receipts", "spare_part_orders", "spare_part_order_items", "spare_part_consumption"],
  "ISO 13485 / MDR / QM": ["bugs", "capas", "capa_actions", "audit_findings", "qm_comments", "qm_attachments", "iso_audits", "iso_audit_findings_ext", "iso_change_controls", "iso_supplier_evaluations", "iso_trainings", "iso_training_records", "mdr_vigilance_reports", "academy_sessions", "academy_bookings"],
  "Mail": ["mail_messages", "mail_attachments", "mail_recipients", "mail_templates", "mail_domains", "mail_campaigns", "mail_followups", "mail_tasks", "mail_notes", "mail_phone_notes", "mail_internal_messages", "mail_notifications", "mail_automations", "mail_automation_runs", "mail_unsubscribes", "mail_events", "email_templates", "email_send_log", "suppressed_emails"],
  "WhatsApp / SMS": ["whatsapp_messages", "whatsapp_templates", "whatsapp_automations", "whatsapp_consents", "whatsapp_sc_conversations", "whatsapp_sc_messages", "whatsapp_sc_templates", "whatsapp_sync_logs", "customer_sms_logs", "sms_templates", "sms_settings"],
  "Service / Warranty / Maintenance": ["warranty_records", "warranty_claims", "warranty_decisions", "warranty_cost_items", "maintenance_plans", "maintenance_confirmations", "maintenance_reminder_log", "goodwill_cases", "service_knowledge_base", "service_communication_log", "service_ai_analyses", "service_ai_repair_guides", "service_ai_feedback", "ai_service_analyses", "ai_service_logs"],
  "AI Center / Insights": ["aic_analysis_runs", "aic_insights", "aic_forecasts", "aic_reports", "aic_report_schedules", "aic_tasks"],
  "AlixSmart": ["alixsmart_products"],
  "App / Sonstiges": ["app_settings", "integration_logs", "invoice_workflow_states"],
};

const ALLOWED_TABLES = new Set<string>(
  Object.values(MODULE_CATALOG).flat().filter((t) => !BLOCKED_TABLES.has(t)),
);

function tableRequiresRole(table: string): string[] | null {
  if (table.startsWith("finance_") || table === "zoho_invoices" || table === "zoho_unpaid_invoices" || table === "bank_financing_requests") {
    return ["Super Admin", "Admin", "Finance"];
  }
  if (table.startsWith("iso_") || table === "mdr_vigilance_reports") {
    return ["Super Admin", "Admin", "QM"];
  }
  if (["bugs", "capas", "capa_actions", "audit_findings", "qm_comments", "qm_attachments"].includes(table)) {
    return ["Super Admin", "Admin", "QM"];
  }
  return null;
}

// ---------- Tool Implementierungen ----------
type Ctx = { userId: string; roles: string[]; isAdmin: boolean; isFinance: boolean; tenantSources: string[] | null; extraBlocked: Set<string>; disabledModules: Set<string> };

function pick<T extends Record<string, unknown>>(row: T, keys: (keyof T)[]): Partial<T> {
  const o: any = {};
  for (const k of keys) if (row[k] !== undefined) o[k] = row[k];
  return o;
}

async function runTool(name: string, args: any, ctx: Ctx): Promise<unknown> {
  const limit = Math.min(Number(args?.limit) || 20, 50);
  const sourceFilter = (q: any) => {
    if (ctx.tenantSources && ctx.tenantSources.length > 0) return q.in("source_system", ctx.tenantSources);
    return q;
  };

  try {
    switch (name) {
      case "search_orders": {
        let q = admin
          .from("orders")
          .select("id, order_number, customer_name, customer_email, status, total, currency_code, source_system, date, created_at")
          .order("created_at", { ascending: false })
          .limit(limit);
        if (args?.query) q = q.or(`order_number.ilike.%${args.query}%,customer_name.ilike.%${args.query}%`);
        if (args?.status) q = q.eq("status", args.status);
        if (args?.source_system) q = q.eq("source_system", args.source_system);
        q = sourceFilter(q);
        const { data, error } = await q;
        if (error) throw error;
        return data;
      }
      case "get_order": {
        const num = String(args.order_number).replace(/-AT$/i, "");
        const { data: order, error } = await admin
          .from("orders")
          .select("id, order_number, customer_name, customer_email, customer_phone, billing_address, shipping_address, status, total, currency_code, source_system, date, created_at, notes")
          .eq("order_number", num)
          .maybeSingle();
        if (error) throw error;
        if (!order) return { error: "Auftrag nicht gefunden", order_number: num };
        const { data: items } = await admin
          .from("order_items")
          .select("id, item_name, sku, quantity, rate, amount")
          .eq("order_id", (order as any).id);
        const { data: history } = await admin
          .from("order_status_history")
          .select("status, created_at, note")
          .eq("order_id", (order as any).id)
          .order("created_at", { ascending: false })
          .limit(5);
        return { order, items: items ?? [], history: history ?? [] };
      }
      case "search_customers": {
        const term = `%${args.query}%`;
        const { data, error } = await admin
          .from("customers")
          .select("id, customer_number, customer_name, email, phone, city, country, source_system, vip")
          .or(`customer_name.ilike.${term},email.ilike.${term},phone.ilike.${term},customer_number.ilike.${term}`)
          .limit(limit);
        if (error) throw error;
        return data;
      }
      case "get_customer": {
        const num = String(args.customer_number).replace(/-AT$/i, "");
        const { data: cust } = await admin
          .from("customers")
          .select("*")
          .eq("customer_number", num)
          .maybeSingle();
        if (!cust) return { error: "Kunde nicht gefunden", customer_number: num };
        const { data: orders } = await admin
          .from("orders")
          .select("order_number, status, total, currency_code, date")
          .eq("customer_id", (cust as any).id)
          .order("date", { ascending: false })
          .limit(20);
        const { data: invoices } = await admin
          .from("zoho_unpaid_invoices")
          .select("invoice_number, balance, due_date, status")
          .eq("customer_id", (cust as any).id)
          .limit(20);
        return { customer: pick(cust as any, ["customer_number", "customer_name", "email", "phone", "city", "country", "source_system", "vip"]), orders, unpaid_invoices: invoices ?? [] };
      }
      case "search_invoices": {
        if (!ctx.isAdmin && !ctx.isFinance) return { error: "Nicht berechtigt – Finance-Rolle nötig." };
        let q = admin
          .from("zoho_invoices")
          .select("invoice_number, customer_name, status, total, balance, currency_code, invoice_date, due_date, source_system")
          .order("invoice_date", { ascending: false })
          .limit(limit);
        if (args?.query) q = q.or(`invoice_number.ilike.%${args.query}%,customer_name.ilike.%${args.query}%`);
        if (args?.status === "overdue") q = q.gt("balance", 0).lt("due_date", new Date().toISOString().slice(0, 10));
        else if (args?.status) q = q.eq("status", args.status);
        if (args?.source_system) q = q.eq("source_system", args.source_system);
        const { data, error } = await q;
        if (error) throw error;
        return data;
      }
      case "search_tickets": {
        let q = admin
          .from("tickets")
          .select("id, ticket_number, subject, status, priority, customer_name, customer_email, created_at")
          .order("created_at", { ascending: false })
          .limit(limit);
        if (args?.query) q = q.or(`subject.ilike.%${args.query}%,ticket_number.ilike.%${args.query}%,customer_name.ilike.%${args.query}%`);
        if (args?.status) q = q.eq("status", args.status);
        const { data, error } = await q;
        if (error) throw error;
        return data;
      }
      case "search_production_orders": {
        let q = admin
          .from("production_orders")
          .select("id, order_number, customer_name, status, approval_status, total, created_at")
          .order("created_at", { ascending: false })
          .limit(limit);
        if (args?.query) q = q.or(`order_number.ilike.%${args.query}%,customer_name.ilike.%${args.query}%`);
        if (args?.status) q = q.eq("status", args.status);
        if (args?.approval_status) q = q.eq("approval_status", args.approval_status);
        const { data, error } = await q;
        if (error) throw error;
        return data;
      }
      case "search_repair_orders": {
        let q = admin
          .from("repair_orders")
          .select("id, repair_number, customer_name, device_model, serial_number, status, created_at")
          .order("created_at", { ascending: false })
          .limit(limit);
        if (args?.query) q = q.or(`repair_number.ilike.%${args.query}%,customer_name.ilike.%${args.query}%,serial_number.ilike.%${args.query}%`);
        if (args?.status) q = q.eq("status", args.status);
        const { data, error } = await q;
        if (error) throw error;
        return data;
      }
      case "search_sales_leads": {
        let q = admin
          .from("sales_leads")
          .select("id, first_name, last_name, company, email, phone, lead_score, score_category, ai_priority, status, created_at")
          .order("created_at", { ascending: false })
          .limit(limit);
        if (args?.query) q = q.or(`first_name.ilike.%${args.query}%,last_name.ilike.%${args.query}%,company.ilike.%${args.query}%,email.ilike.%${args.query}%`);
        if (args?.score_category) q = q.eq("score_category", args.score_category);
        const { data, error } = await q;
        if (error) throw error;
        return data;
      }
      case "search_lager_devices": {
        let q = admin
          .from("lager_devices")
          .select("id, serial_number, model, status, location, reserved_for, source_system, updated_at")
          .order("updated_at", { ascending: false })
          .limit(limit);
        if (args?.query) q = q.or(`serial_number.ilike.%${args.query}%,model.ilike.%${args.query}%,reserved_for.ilike.%${args.query}%`);
        if (args?.status) q = q.eq("status", args.status);
        const { data, error } = await q;
        if (error) throw error;
        return data;
      }
      case "kpi_overview": {
        const today = new Date().toISOString().slice(0, 10);
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
        const [orders, tickets, overdue, leads] = await Promise.all([
          admin.from("orders").select("id", { count: "exact", head: true }).neq("status", "closed"),
          admin.from("tickets").select("id", { count: "exact", head: true }).neq("status", "closed"),
          admin.from("zoho_unpaid_invoices").select("invoice_number", { count: "exact", head: true }).lt("due_date", today),
          admin.from("sales_leads").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
        ]);
        return {
          offene_auftraege: orders.count ?? 0,
          offene_tickets: tickets.count ?? 0,
          ueberfaellige_rechnungen: overdue.count ?? 0,
          neue_leads_7d: leads.count ?? 0,
        };
      }
      case "list_modules": {
        const out: Record<string, string[]> = {};
        for (const [mod, tables] of Object.entries(MODULE_CATALOG)) {
          const allowed = tables.filter((t) => {
            if (BLOCKED_TABLES.has(t)) return false;
            const req = tableRequiresRole(t);
            if (!req) return true;
            return ctx.isAdmin || ctx.roles.some((r) => req.includes(r));
          });
          if (allowed.length > 0) out[mod] = allowed;
        }
        return { modules: out, blocked_for_security: Array.from(BLOCKED_TABLES) };
      }
      case "describe_table": {
        const t = String(args?.table ?? "").trim();
        if (!ALLOWED_TABLES.has(t)) return { error: `Tabelle '${t}' nicht erlaubt oder unbekannt.` };
        const req = tableRequiresRole(t);
        if (req && !ctx.isAdmin && !ctx.roles.some((r) => req.includes(r))) {
          return { error: `Keine Berechtigung für '${t}'. Benötigt eine der Rollen: ${req.join(", ")}.` };
        }
        const { data, error } = await admin.rpc("get_table_columns", { _table: t });
        if (error) throw error;
        return { table: t, columns: data ?? [] };
      }
      case "query_table": {
        const t = String(args?.table ?? "").trim();
        if (!/^[a-z_][a-z0-9_]*$/i.test(t)) return { error: "Ungültiger Tabellenname." };
        if (!ALLOWED_TABLES.has(t)) return { error: `Tabelle '${t}' nicht erlaubt. Nutze list_modules.` };
        const req = tableRequiresRole(t);
        if (req && !ctx.isAdmin && !ctx.roles.some((r) => req.includes(r))) {
          return { error: `Keine Berechtigung für '${t}'. Benötigt eine der Rollen: ${req.join(", ")}.` };
        }
        const select = typeof args?.select === "string" && args.select.trim().length > 0 ? args.select : "*";
        let q: any = admin.from(t).select(select).limit(limit);

        // Mandantenfilter wo passend
        if (ctx.tenantSources && ["orders", "customers", "production_orders", "zoho_invoices", "zoho_unpaid_invoices", "zoho_items", "lager_devices"].includes(t)) {
          q = q.in("source_system", ctx.tenantSources);
        }

        if (args?.search?.term && Array.isArray(args.search.columns) && args.search.columns.length > 0) {
          const term = String(args.search.term).replace(/[%,]/g, " ");
          const or = args.search.columns
            .filter((c: any) => typeof c === "string" && /^[a-z_][a-z0-9_]*$/i.test(c))
            .map((c: string) => `${c}.ilike.%${term}%`)
            .join(",");
          if (or) q = q.or(or);
        }

        if (Array.isArray(args?.filters)) {
          for (const f of args.filters) {
            if (!f?.column || !/^[a-z_][a-z0-9_]*$/i.test(f.column)) continue;
            const op = String(f.op);
            const v = f.value;
            switch (op) {
              case "eq": q = q.eq(f.column, v); break;
              case "neq": q = q.neq(f.column, v); break;
              case "ilike": q = q.ilike(f.column, `%${String(v).replace(/%/g, "")}%`); break;
              case "gt": q = q.gt(f.column, v); break;
              case "gte": q = q.gte(f.column, v); break;
              case "lt": q = q.lt(f.column, v); break;
              case "lte": q = q.lte(f.column, v); break;
              case "in": q = q.in(f.column, Array.isArray(v) ? v : [v]); break;
              case "is": q = q.is(f.column, v); break;
            }
          }
        }

        if (args?.order_by && /^[a-z_][a-z0-9_]*$/i.test(String(args.order_by))) {
          q = q.order(args.order_by, { ascending: Boolean(args.ascending) });
        }

        const { data, error, count } = await q;
        if (error) return { error: error.message };
        return { table: t, rows: data ?? [], row_count: (data?.length ?? 0), total_count: count ?? null };
      }
    }
    return { error: `Unbekanntes Tool: ${name}` };
  } catch (e: any) {
    return { error: String(e?.message ?? e) };
  }
}

// ---------- Handler ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY fehlt" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Nicht authentifiziert" }, 401);

    const body = await req.json();
    const { messages = [], page, tenantSources } = body ?? {};
    if (!Array.isArray(messages) || messages.length === 0) return json({ error: "messages required" }, 400);

    // Rollen laden
    const { data: roleRows } = await admin
      .from("user_roles")
      .select("roles(name)")
      .eq("user_id", user.id);
    const roles: string[] = (roleRows ?? []).map((r: any) => r.roles?.name).filter(Boolean);
    const ctx: Ctx = {
      userId: user.id,
      roles,
      isAdmin: roles.some((r) => r === "Super Admin" || r === "Admin"),
      isFinance: roles.some((r) => r === "Finance" || r === "Super Admin" || r === "Admin"),
      tenantSources: Array.isArray(tenantSources) && tenantSources.length > 0 ? tenantSources : null,
    };

    const sysContext = `Aktueller Nutzer: ${user.email ?? user.id}. Rollen: ${roles.join(", ") || "(keine)"}. Aktive Seite: ${page ?? "-"}. ${ctx.tenantSources ? `Aktiver Mandant-Filter: ${ctx.tenantSources.join(",")}` : "Mandant: alle"}`;

    const chatMessages: any[] = [
      { role: "system", content: KNOWLEDGE },
      { role: "system", content: sysContext },
      ...messages,
    ];

    const toolTrace: { name: string; args: any }[] = [];

    // Tool-Loop (max. 6 Iterationen)
    for (let i = 0; i < 6; i++) {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": LOVABLE_API_KEY!,
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: chatMessages,
          tools,
          tool_choice: "auto",
        }),
      });
      if (aiRes.status === 429) return json({ error: "Rate Limit erreicht." }, 429);
      if (aiRes.status === 402) return json({ error: "AI-Guthaben aufgebraucht." }, 402);
      if (!aiRes.ok) {
        const txt = await aiRes.text();
        return json({ error: `AI-Fehler ${aiRes.status}: ${txt.slice(0, 400)}` }, 502);
      }
      const data = await aiRes.json();
      const msg = data.choices?.[0]?.message;
      if (!msg) return json({ error: "Leere AI-Antwort" }, 502);

      const toolCalls = msg.tool_calls ?? [];
      if (toolCalls.length === 0) {
        return json({ content: msg.content ?? "", tool_trace: toolTrace });
      }

      chatMessages.push(msg);
      for (const tc of toolCalls) {
        let parsedArgs: any = {};
        try { parsedArgs = JSON.parse(tc.function?.arguments ?? "{}"); } catch { /* */ }
        toolTrace.push({ name: tc.function?.name, args: parsedArgs });
        const result = await runTool(tc.function?.name, parsedArgs, ctx);
        chatMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result).slice(0, 12000),
        });
      }
    }

    return json({ content: "Konnte innerhalb des Tool-Limits keine endgültige Antwort erzeugen.", tool_trace: toolTrace });
  } catch (e) {
    return json({ error: (e as Error)?.message ?? "Unbekannter Fehler" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
