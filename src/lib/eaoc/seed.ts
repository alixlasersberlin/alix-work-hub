import { eaoc } from "./store";

const SEED_FLAG = "eaoc:seeded:v1";

export function ensureEaocSeed() {
  if (localStorage.getItem(SEED_FLAG)) return;
  const now = new Date().toISOString();
  const mk = (extra: any) => ({ createdAt: now, updatedAt: now, tenant: "ABLM Management GmbH", ...extra });

  eaoc.save("companies", [
    mk({ id: "c_ablm", name: "ABLM Management GmbH", legal: "GmbH", city: "Berlin", country: "DE", currency: "EUR", tz: "Europe/Berlin", active: true, parent: "" }),
    mk({ id: "c_bt", name: "BeautyTec Holding", legal: "Holding", city: "Berlin", country: "DE", currency: "EUR", tz: "Europe/Berlin", active: true, parent: "c_ablm" }),
    mk({ id: "c_al", name: "Alix Lasers GmbH", legal: "GmbH", city: "Berlin", country: "DE", currency: "EUR", tz: "Europe/Berlin", active: true, parent: "c_bt" }),
    mk({ id: "c_am", name: "Alix Medical GmbH", legal: "GmbH", city: "Wien", country: "AT", currency: "EUR", tz: "Europe/Vienna", active: true, parent: "c_bt" }),
    mk({ id: "c_mm", name: "Medi Metropole GmbH", legal: "GmbH", city: "Miami", country: "US", currency: "USD", tz: "America/New_York", active: true, parent: "c_bt" }),
  ]);

  eaoc.save("tenants", [
    mk({ id: "t_de", name: "Alix Deutschland", brand: "Alix", primaryColor: "#f4c430", locale: "de-DE", currency: "EUR", active: true }),
    mk({ id: "t_at", name: "Alix Austria", brand: "Alix", primaryColor: "#e11d48", locale: "de-AT", currency: "EUR", active: true }),
    mk({ id: "t_us", name: "Medi Metropole US", brand: "MediMetropole", primaryColor: "#0ea5e9", locale: "en-US", currency: "USD", active: true }),
  ]);

  eaoc.save("locations", [
    mk({ id: "l_berlin", name: "Berlin HQ", address: "Beuthstr. 7, 10117 Berlin", phone: "+49 30 000000", tz: "Europe/Berlin", country: "DE" }),
    mk({ id: "l_wien", name: "Wien Office", address: "Kärntner Ring 12, 1010 Wien", phone: "+43 1 000000", tz: "Europe/Vienna", country: "AT" }),
    mk({ id: "l_dubai", name: "Dubai Branch", address: "Sheikh Zayed Rd, Dubai", phone: "+971 4 0000000", tz: "Asia/Dubai", country: "AE" }),
    mk({ id: "l_miami", name: "Miami Office", address: "Brickell Ave, Miami FL", phone: "+1 305 000000", tz: "America/New_York", country: "US" }),
    mk({ id: "l_riga", name: "Riga Support", address: "Elizabetes iela, Riga", phone: "+371 6 000000", tz: "Europe/Riga", country: "LV" }),
  ]);

  eaoc.save("departments", [
    mk({ id: "d_sales", name: "Sales", head: "Anna Weber" }),
    mk({ id: "d_service", name: "Service", head: "Ben Schulz" }),
    mk({ id: "d_marketing", name: "Marketing", head: "Clara Hoch" }),
    mk({ id: "d_tech", name: "Technik", head: "Daniel Roth" }),
    mk({ id: "d_school", name: "Schulung", head: "Elena Vogt" }),
    mk({ id: "d_nisv", name: "NiSV", head: "Frank Meier" }),
    mk({ id: "d_delivery", name: "Lieferung", head: "Gina Kraus" }),
    mk({ id: "d_compliance", name: "Compliance", head: "Hans Berg" }),
    mk({ id: "d_finance", name: "Finanzen", head: "Ines Klar" }),
    mk({ id: "d_exec", name: "Geschäftsleitung", head: "Julian Wolf" }),
  ]);

  eaoc.save("teams", [
    mk({ id: "tm_svn", name: "Service Nord", lead: "Ben Schulz", members: 6 }),
    mk({ id: "tm_svs", name: "Service Süd", lead: "Ben Schulz", members: 5 }),
    mk({ id: "tm_sdach", name: "Sales DACH", lead: "Anna Weber", members: 8 }),
    mk({ id: "tm_meu", name: "Marketing Europe", lead: "Clara Hoch", members: 4 }),
    mk({ id: "tm_tbln", name: "Trainer Berlin", lead: "Elena Vogt", members: 3 }),
    mk({ id: "tm_twien", name: "Trainer Wien", lead: "Elena Vogt", members: 2 }),
  ]);

  eaoc.save("users", [
    mk({ id: "u_admin", name: "Alix Admin", email: "admin@alixworks", role: "Administrator", department: "Geschäftsleitung", location: "Berlin HQ", status: "aktiv", locale: "de-DE" }),
    mk({ id: "u_anna", name: "Anna Weber", email: "anna.weber@alix", role: "Sales", department: "Sales", location: "Berlin HQ", status: "aktiv", locale: "de-DE" }),
    mk({ id: "u_ben", name: "Ben Schulz", email: "ben.schulz@alix", role: "Service", department: "Service", location: "Berlin HQ", status: "aktiv", locale: "de-DE" }),
    mk({ id: "u_clara", name: "Clara Hoch", email: "clara.hoch@alix", role: "Marketing", department: "Marketing", location: "Wien Office", status: "aktiv", locale: "de-AT" }),
  ]);

  eaoc.save("roles", [
    mk({ id: "r_admin", name: "Administrator", scope: "global", description: "Vollzugriff" }),
    mk({ id: "r_gl", name: "Geschäftsleitung", scope: "tenant", description: "Executive" }),
    mk({ id: "r_sales", name: "Sales", scope: "tenant", description: "Vertrieb" }),
    mk({ id: "r_service", name: "Service", scope: "tenant", description: "Serviceteam" }),
    mk({ id: "r_trainer", name: "Trainer", scope: "tenant", description: "Schulung" }),
    mk({ id: "r_marketing", name: "Marketing", scope: "tenant", description: "Marketing" }),
    mk({ id: "r_accounting", name: "Buchhaltung", scope: "tenant", description: "Finanzen" }),
    mk({ id: "r_compliance", name: "Compliance", scope: "tenant", description: "QM/RA" }),
    mk({ id: "r_support", name: "Support", scope: "tenant", description: "Support" }),
    mk({ id: "r_customer", name: "Kunde", scope: "portal", description: "Kundenportal" }),
    mk({ id: "r_dealer", name: "Händler", scope: "portal", description: "Händlerportal" }),
    mk({ id: "r_partner", name: "Servicepartner", scope: "portal", description: "Servicepartner" }),
    mk({ id: "r_supplier", name: "Lieferant", scope: "portal", description: "Lieferant" }),
  ]);

  const PERMS = ["sehen","erstellen","aendern","loeschen","freigeben","exportieren","importieren","berichte","api","audit","dashboard","kalender","crm","dokumente"];
  eaoc.save("permissions", PERMS.map((p, i) => mk({ id: `p_${p}`, code: p, name: p, module: "core", enabled: true, sort: i })));

  eaoc.save("branding", [
    mk({ id: "b_de", tenantName: "Alix Deutschland", logo: "/logo-de.svg", primary: "#f4c430", secondary: "#0f172a", font: "Inter", theme: "dark" }),
    mk({ id: "b_at", tenantName: "Alix Austria", logo: "/logo-at.svg", primary: "#e11d48", secondary: "#0f172a", font: "Inter", theme: "dark" }),
  ]);

  eaoc.save("licenses", [
    mk({ id: "lic_esc", module: "Enterprise Scheduling", plan: "Enterprise", status: "aktiv", validUntil: "2027-12-31" }),
    mk({ id: "lic_ecp", module: "Customer Portal", plan: "Professional", status: "aktiv", validUntil: "2026-12-31" }),
    mk({ id: "lic_abic", module: "Analytics BI", plan: "Enterprise", status: "aktiv", validUntil: "2027-12-31" }),
    mk({ id: "lic_ecqm", module: "Compliance & QM", plan: "Enterprise", status: "aktiv", validUntil: "2027-12-31" }),
    mk({ id: "lic_emp", module: "Mobile Platform", plan: "Professional", status: "test", validUntil: "2026-06-30" }),
  ]);

  eaoc.save("api_keys", [
    mk({ id: "ak_1", name: "Reporting Read", scopes: "read:reports,read:kpis", createdBy: "Alix Admin", lastUsed: now, expiresAt: "2026-12-31", masked: "sk_live_••••1234" }),
    mk({ id: "ak_2", name: "Integration Sync", scopes: "read:crm,write:crm", createdBy: "Alix Admin", lastUsed: now, expiresAt: "2026-06-30", masked: "sk_live_••••abcd" }),
  ]);

  eaoc.save("webhooks", [
    mk({ id: "wh_crm", name: "CRM Events", url: "https://hooks.example.com/crm", events: "crm.customer.created,crm.customer.updated", status: "aktiv", retries: 3 }),
    mk({ id: "wh_svc", name: "Service Events", url: "https://hooks.example.com/service", events: "service.ticket.*", status: "aktiv", retries: 5 }),
  ]);

  eaoc.save("integrations", [
    mk({ id: "int_ms", name: "Microsoft 365", status: "verbunden", type: "identity+mail+calendar" }),
    mk({ id: "int_google", name: "Google Workspace", status: "getrennt", type: "identity+mail+calendar" }),
    mk({ id: "int_exchange", name: "Exchange", status: "verbunden", type: "mail+calendar" }),
    mk({ id: "int_twilio", name: "Twilio", status: "verbunden", type: "sms" }),
    mk({ id: "int_wa", name: "WhatsApp Business", status: "verbunden", type: "messaging" }),
    mk({ id: "int_zoom", name: "Zoom", status: "verbunden", type: "meetings" }),
    mk({ id: "int_teams", name: "Microsoft Teams", status: "verbunden", type: "meetings+chat" }),
    mk({ id: "int_stripe", name: "Stripe", status: "verbunden", type: "payments" }),
  ]);

  eaoc.save("security_policies", [
    mk({ id: "sec_pw", name: "Passwortrichtlinie", minLength: 12, mfa: "vorbereitet", sessionMinutes: 60, ipAllowlist: "" }),
  ]);

  eaoc.save("system_settings", [
    mk({ id: "sys_general", name: "System", defaultLocale: "de-DE", defaultTz: "Europe/Berlin", supportEmail: "support@alixworks", theme: "dark" }),
  ]);

  eaoc.save("notifications", [
    mk({ id: "n_email", channel: "E-Mail", enabled: true, template: "default" }),
    mk({ id: "n_sms", channel: "SMS", enabled: true, template: "kurz" }),
    mk({ id: "n_wa", channel: "WhatsApp", enabled: true, template: "termin" }),
    mk({ id: "n_push", channel: "Push", enabled: true, template: "app" }),
    mk({ id: "n_teams", channel: "Teams", enabled: false, template: "-" }),
    mk({ id: "n_webhook", channel: "Webhook", enabled: true, template: "generic" }),
  ]);

  eaoc.save("jobs", [
    mk({ id: "j_cal", name: "Kalendersynchronisation", schedule: "*/15 * * * *", lastRun: now, status: "ok" }),
    mk({ id: "j_backup", name: "Backup", schedule: "0 3 * * *", lastRun: now, status: "ok" }),
    mk({ id: "j_mail", name: "E-Mail Versand", schedule: "*/5 * * * *", lastRun: now, status: "ok" }),
    mk({ id: "j_remind", name: "Erinnerungen", schedule: "0 * * * *", lastRun: now, status: "ok" }),
    mk({ id: "j_report", name: "Berichte", schedule: "0 6 * * 1", lastRun: now, status: "ok" }),
    mk({ id: "j_cleanup", name: "Bereinigung", schedule: "0 4 * * 0", lastRun: now, status: "ok" }),
  ]);

  eaoc.save("backups", [
    mk({ id: "bk_1", name: "Nightly Full", type: "full", size: "12.4 GB", createdAt: now, status: "ok" }),
    mk({ id: "bk_2", name: "Hourly Delta", type: "delta", size: "180 MB", createdAt: now, status: "ok" }),
  ]);

  eaoc.save("oauth_clients", [
    mk({ id: "oc_portal", name: "ECP Portal", clientId: "ecp-portal", grantTypes: "authorization_code", redirects: "https://portal.alixworks/callback" }),
  ]);
  eaoc.save("sso_providers", [
    mk({ id: "sso_ms", name: "Microsoft Entra (OIDC)", type: "OIDC", status: "vorbereitet" }),
    mk({ id: "sso_saml", name: "SAML 2.0 IdP", type: "SAML", status: "vorbereitet" }),
  ]);
  eaoc.save("feature_flags", [
    mk({ id: "ff_sso", name: "sso.enabled", enabled: false, description: "Single Sign-On aktivieren" }),
    mk({ id: "ff_scim", name: "scim.provisioning", enabled: false, description: "SCIM-Provisionierung" }),
    mk({ id: "ff_fido", name: "auth.fido2", enabled: false, description: "FIDO2/WebAuthn" }),
    mk({ id: "ff_multiregion", name: "infra.multiregion", enabled: false, description: "Mehrregionenbetrieb" }),
  ]);

  localStorage.setItem(SEED_FLAG, "1");
}
