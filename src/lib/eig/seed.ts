import { eig } from "./store";
const FLAG = "eig:seeded:v1";

export function ensureEigSeed() {
  if (localStorage.getItem(FLAG)) return;
  const now = new Date().toISOString();
  const mk = (extra: any) => ({ createdAt: now, updatedAt: now, tenant: "ABLM Management GmbH", ...extra });

  eig.save("apis", [
    mk({ id: "api_crm", name: "CRM API", version: "v1", scope: "internal", status: "aktiv", basePath: "/api/crm", auth: "Bearer", rateLimit: "600/min" }),
    mk({ id: "api_cal", name: "Calendar API", version: "v1", scope: "internal", status: "aktiv", basePath: "/api/calendar", auth: "Bearer", rateLimit: "600/min" }),
    mk({ id: "api_cust", name: "Customer API", version: "v1", scope: "internal", status: "aktiv", basePath: "/api/customer", auth: "Bearer", rateLimit: "600/min" }),
    mk({ id: "api_svc", name: "Service API", version: "v1", scope: "internal", status: "aktiv", basePath: "/api/service", auth: "Bearer", rateLimit: "600/min" }),
    mk({ id: "api_train", name: "Training API", version: "v1", scope: "internal", status: "aktiv", basePath: "/api/training", auth: "Bearer", rateLimit: "300/min" }),
    mk({ id: "api_comp", name: "Compliance API", version: "v1", scope: "internal", status: "aktiv", basePath: "/api/compliance", auth: "Bearer", rateLimit: "120/min" }),
    mk({ id: "api_analytics", name: "Analytics API", version: "v1", scope: "internal", status: "aktiv", basePath: "/api/analytics", auth: "Bearer", rateLimit: "120/min" }),
    mk({ id: "api_doc", name: "Document API", version: "v1", scope: "internal", status: "aktiv", basePath: "/api/documents", auth: "Bearer", rateLimit: "300/min" }),
    mk({ id: "api_notify", name: "Notification API", version: "v1", scope: "internal", status: "aktiv", basePath: "/api/notify", auth: "Bearer", rateLimit: "1200/min" }),
    mk({ id: "api_wf", name: "Workflow API", version: "v1", scope: "internal", status: "aktiv", basePath: "/api/workflow", auth: "Bearer", rateLimit: "600/min" }),
    mk({ id: "api_qm", name: "Quality API", version: "v1", scope: "internal", status: "aktiv", basePath: "/api/quality", auth: "Bearer", rateLimit: "120/min" }),
    mk({ id: "api_admin", name: "Administration API", version: "v1", scope: "internal", status: "aktiv", basePath: "/api/admin", auth: "Bearer", rateLimit: "60/min" }),
  ]);

  eig.save("events", [
    "customer.created","customer.updated","customer.deleted",
    "event.created","event.updated","event.confirmed",
    "service.created","service.completed",
    "training.completed",
    "ticket.created","ticket.closed",
    "document.approved","capa.created","audit.completed",
    "user.created","login.success",
  ].map((e, i) => mk({ id: `ev_${i}`, name: e, module: e.split(".")[0], description: `Event ${e}`, active: true })));

  eig.save("webhooks", [
    mk({ id: "wh_crm", name: "CRM Consumer", url: "https://hooks.example.com/crm", events: "customer.*", status: "aktiv", retries: 3, signed: true }),
    mk({ id: "wh_svc", name: "Service Consumer", url: "https://hooks.example.com/service", events: "service.*,ticket.*", status: "aktiv", retries: 5, signed: true }),
  ]);

  eig.save("workflows", [
    mk({ id: "wf_confirm", name: "Termin bestätigt → Mail + CRM + Auftrag", trigger: "event.confirmed", steps: 5, status: "aktiv" }),
    mk({ id: "wf_ticket", name: "Neues Ticket → Zuweisung + Notify", trigger: "ticket.created", steps: 4, status: "aktiv" }),
    mk({ id: "wf_capa", name: "CAPA → Freigabe + Audit-Log", trigger: "capa.created", steps: 3, status: "entwurf" }),
  ]);

  eig.save("integrations", [
    mk({ id: "in_ms365", name: "Microsoft 365", type: "identity+mail+calendar", status: "verbunden" }),
    mk({ id: "in_google", name: "Google Workspace", type: "identity+mail+calendar", status: "vorbereitet" }),
    mk({ id: "in_datev", name: "DATEV", type: "erp", status: "vorbereitet" }),
    mk({ id: "in_lex", name: "Lexoffice", type: "erp", status: "vorbereitet" }),
    mk({ id: "in_sap", name: "SAP", type: "erp", status: "vorbereitet" }),
    mk({ id: "in_hs", name: "HubSpot", type: "crm", status: "vorbereitet" }),
    mk({ id: "in_stripe", name: "Stripe", type: "payments", status: "verbunden" }),
    mk({ id: "in_paypal", name: "PayPal", type: "payments", status: "vorbereitet" }),
    mk({ id: "in_shopify", name: "Shopify", type: "commerce", status: "vorbereitet" }),
    mk({ id: "in_woo", name: "WooCommerce", type: "commerce", status: "vorbereitet" }),
    mk({ id: "in_dhl", name: "DHL", type: "shipping", status: "vorbereitet" }),
    mk({ id: "in_ups", name: "UPS", type: "shipping", status: "vorbereitet" }),
    mk({ id: "in_fedex", name: "FedEx", type: "shipping", status: "vorbereitet" }),
    mk({ id: "in_twilio", name: "Twilio", type: "sms", status: "verbunden" }),
    mk({ id: "in_wa", name: "WhatsApp Business", type: "messaging", status: "verbunden" }),
    mk({ id: "in_zoom", name: "Zoom", type: "meetings", status: "verbunden" }),
    mk({ id: "in_teams", name: "Microsoft Teams", type: "meetings+chat", status: "verbunden" }),
    mk({ id: "in_meet", name: "Google Meet", type: "meetings", status: "vorbereitet" }),
  ]);

  eig.save("mappings", [
    mk({ id: "map_cust_zoho", name: "Zoho Kunden → Alix", source: "zoho.customers", target: "alix.customer", rules: 12, status: "aktiv" }),
    mk({ id: "map_inv_datev", name: "Rechnungen → DATEV", source: "alix.invoice", target: "datev.buchung", rules: 20, status: "vorbereitet" }),
  ]);

  eig.save("jobs", [
    mk({ id: "j_sync_cal", name: "Kalender Sync", type: "sync", schedule: "*/15 * * * *", priority: "hoch", lastRun: now, status: "ok" }),
    mk({ id: "j_import_zoho", name: "Zoho Import", type: "import", schedule: "0 */2 * * *", priority: "mittel", lastRun: now, status: "ok" }),
    mk({ id: "j_export_datev", name: "DATEV Export", type: "export", schedule: "0 3 * * *", priority: "hoch", lastRun: now, status: "ok" }),
    mk({ id: "j_notify", name: "Notification Queue", type: "notify", schedule: "* * * * *", priority: "hoch", lastRun: now, status: "ok" }),
    mk({ id: "j_ai", name: "AI Auswertungen", type: "ai", schedule: "0 4 * * *", priority: "niedrig", lastRun: now, status: "ok" }),
  ]);

  eig.save("queues", [
    mk({ id: "q_default", name: "default", type: "job", depth: 12, retries: 3 }),
    mk({ id: "q_priority", name: "priority", type: "priority", depth: 2, retries: 5 }),
    mk({ id: "q_retry", name: "retry", type: "retry", depth: 4, retries: 5 }),
    mk({ id: "q_dead", name: "dead-letter", type: "dead-letter", depth: 1, retries: 0 }),
  ]);

  eig.save("plugins", [
    mk({ id: "pl_stripe", name: "Stripe Plugin", version: "1.0.0", status: "aktiv", vendor: "Alix", scopes: "payments" }),
    mk({ id: "pl_datev", name: "DATEV Plugin", version: "0.9.0", status: "beta", vendor: "Alix", scopes: "accounting" }),
  ]);

  eig.save("api_keys", [
    mk({ id: "k_read", name: "Reporting Read", scopes: "read:reports", masked: "eig_••••1234", expiresAt: "2027-12-31", createdBy: "admin" }),
  ]);

  eig.save("errors", [
    mk({ id: "err_1", code: "E-401", module: "Auth", source: "api-gateway", user: "system", ts: now, priority: "hoch", message: "Ungültiger Token", suggestion: "Token rotieren" }),
    mk({ id: "err_2", code: "E-502", module: "Shipping", source: "dhl-adapter", user: "system", ts: now, priority: "mittel", message: "Timeout", suggestion: "Retry" }),
  ]);

  // seed some event history + logs
  const modules = ["crm","service","calendar","tickets","training","compliance","admin"];
  for (let i = 0; i < 30; i++) {
    eig.events.emit({ event: ["customer.created","service.completed","event.confirmed","ticket.created","document.approved"][i % 5], module: modules[i % modules.length], status: i % 9 === 0 ? "failed" : "delivered", latencyMs: 40 + (i * 3) % 200 });
  }
  eig.logs.add({ level: "info", source: "gateway", message: "EIG initialized" });
  eig.logs.add({ level: "warn", source: "shipping", message: "DHL sandbox rate-limited" });
  eig.logs.add({ level: "error", source: "workflow", message: "wf_capa step 2 failed – retry scheduled" });

  localStorage.setItem(FLAG, "1");
}
