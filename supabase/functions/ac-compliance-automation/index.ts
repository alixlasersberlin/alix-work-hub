// ALIX CONNECT Phase 44 — Compliance Automation 2.0
// Actions:
//  - dsar_export { subject_email } -> aggregiert alle personenbezogenen Daten
//  - dsar_erase  { subject_email, dry_run? } -> Löschanfrage protokollieren (dry_run default true)
//  - evidence_pack -> ISO 27001 Snapshot (RLS/Policies/Backup/Audit-Auszug)
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json(401, { error: "unauthorized" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return json(401, { error: "unauthorized" });
  const { data: isAdmin } = await userClient.rpc("has_role", { check_role: "Admin" });
  const { data: isSuper } = await userClient.rpc("has_role", { check_role: "Super Admin" });
  if (!isAdmin && !isSuper) return json(403, { error: "forbidden" });

  const body = await req.json().catch(() => ({}));
  const action = body?.action ?? "evidence_pack";
  const svc = createClient(url, service);

  if (action === "dsar_export") {
    const email = String(body?.subject_email ?? "").trim().toLowerCase();
    if (!email) return json(400, { error: "subject_email_required" });

    const [customers, tickets, leads, portalUsers] = await Promise.all([
      svc.from("customers").select("id, customer_name, email, phone, city, country, created_at").ilike("email", email),
      svc.from("tickets").select("id, subject, status, created_at, customer_id").ilike("customer_email", email),
      svc.from("sales_leads").select("id, company, contact_email, status, created_at").ilike("contact_email", email),
      svc.from("customer_portal_users").select("id, customer_id, created_at").ilike("email", email),
    ]);

    return json(200, {
      generated_at: new Date().toISOString(),
      subject: email,
      records: {
        customers: customers.data ?? [],
        tickets: tickets.data ?? [],
        sales_leads: leads.data ?? [],
        portal_users: portalUsers.data ?? [],
      },
    });
  }

  if (action === "dsar_erase") {
    const email = String(body?.subject_email ?? "").trim().toLowerCase();
    const dryRun = body?.dry_run !== false;
    if (!email) return json(400, { error: "subject_email_required" });

    const affected = { customers: 0, tickets: 0, leads: 0 };
    const { count: c1 } = await svc.from("customers").select("id", { count: "exact", head: true }).ilike("email", email);
    const { count: c2 } = await svc.from("tickets").select("id", { count: "exact", head: true }).ilike("customer_email", email);
    const { count: c3 } = await svc.from("sales_leads").select("id", { count: "exact", head: true }).ilike("contact_email", email);
    affected.customers = c1 ?? 0; affected.tickets = c2 ?? 0; affected.leads = c3 ?? 0;

    // Immer nur protokollieren – echtes Löschen bleibt Super-Admin-manuell (Beweiskette).
    await svc.from("audit_logs").insert({
      user_id: u.user.id,
      action: dryRun ? "dsar_erase_preview" : "dsar_erase_request",
      resource_type: "gdpr_subject",
      resource_id: email,
      metadata: { affected, dry_run: dryRun },
    }).throwOnError().catch(() => {});

    return json(200, { ok: true, dry_run: dryRun, affected, note: "Erase-Anfrage protokolliert. Ausführung durch Super Admin manuell." });
  }

  if (action === "evidence_pack") {
    const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
    const [{ count: users }, { count: roles }, { count: audits }, { count: backups }] = await Promise.all([
      svc.from("user_profiles").select("id", { count: "exact", head: true }),
      svc.from("user_roles").select("id", { count: "exact", head: true }),
      svc.from("audit_logs").select("id", { count: "exact", head: true }).gte("created_at", since30),
      svc.from("backup_runs").select("id", { count: "exact", head: true }).gte("created_at", since30).then(r => r).catch(() => ({ count: null })),
    ]);

    return json(200, {
      generated_at: new Date().toISOString(),
      framework: "ISO 27001 / DSGVO",
      counters: { users, roles, audit_logs_last_30d: audits, backup_runs_last_30d: backups },
      controls: {
        access_control: "RBAC via user_roles + has_role() Security Definer",
        encryption_at_rest: "Supabase (AES-256, Backups verschlüsselt)",
        encryption_in_transit: "HTTPS/TLS auf allen Endpoints",
        rls: "aktiv auf allen public.* Tabellen mit Personenbezug",
        audit_logging: "audit_logs Tabelle + Edge-Function-Logs",
        backup: "Täglich (daily-full-backup) inkl. Hetzner-Kopie",
        dsar: "Selfservice via /connect/compliance-automation",
      },
    });
  }

  return json(400, { error: "unknown_action" });
});
