// AlixSmart Import Engine
// Pulls data from AlixSmart export endpoint and upserts it into AlixWork.
// NEVER touches ticket-related tables. Only Super Admin / Admin may call.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EXPORT_URL =
  Deno.env.get("ALIXSMART_EXPORT_URL") ||
  "https://alix-client-haven.lovable.app/functions/v1/alixsmart-export-readonly";
const EXPORT_KEY = Deno.env.get("ALIXSMART_EXPORT_KEY") || "";

// Tables that MUST NEVER be imported (tickets etc.)
const FORBIDDEN = new Set([
  "tickets",
  "service_tickets",
  "ticket_replies",
  "ticket_messages",
  "ticket_attachments",
  "message_attachments",
  "ticket_sync_status",
  "ticket_sync_logs",
]);

// Source-table → target-table mapping
const TABLE_MAP: Record<
  string,
  { target: string; matchKey: string; wave: 1 | 2 | 3 | 4 }
> = {
  profiles: { target: "user_profiles", matchKey: "email", wave: 1 },
  user_roles: { target: "user_roles", matchKey: "user_id+role", wave: 1 },
  products: { target: "alixsmart_products", matchKey: "source_id", wave: 1 },
  devices: { target: "lager_devices", matchKey: "serial_number", wave: 1 },
  model_manuals: { target: "model_manuals", matchKey: "source_id", wave: 2 },
  support_videos: { target: "support_videos", matchKey: "source_id", wave: 2 },
  customer_notes: { target: "customer_notes", matchKey: "source_id", wave: 2 },
  maintenance_confirmations: {
    target: "maintenance_confirmations",
    matchKey: "source_id",
    wave: 2,
  },
  academy_sessions: {
    target: "academy_sessions",
    matchKey: "source_id",
    wave: 3,
  },
  academy_bookings: {
    target: "academy_bookings",
    matchKey: "source_id",
    wave: 3,
  },
  internal_messages: {
    target: "mail_internal_messages",
    matchKey: "source_id",
    wave: 3,
  },
  email_unsubscribe_tokens: {
    target: "email_unsubscribe_tokens",
    matchKey: "source_id",
    wave: 4,
  },
  suppressed_emails: {
    target: "suppressed_emails",
    matchKey: "email",
    wave: 4,
  },
  audit_logs: { target: "audit_logs", matchKey: "source_id", wave: 4 },
  email_send_log: { target: "email_send_log", matchKey: "source_id", wave: 4 },
};

const ROLE_MAP: Record<string, string> = {
  admin: "Admin",
  superadmin: "Super Admin",
  super_admin: "Super Admin",
  staff: "Order",
  technician: "Technik",
  service: "Service",
  finance: "Finance",
  customer: "Kunde",
  user: "Order",
};

interface Ctx {
  admin: ReturnType<typeof createClient>;
  userId: string;
  batchId: string;
}

async function fetchTable(
  table: string,
  limit = 100,
  offset = 0,
): Promise<{ rows: any[]; total?: number; error?: string }> {
  if (!EXPORT_KEY) {
    return { rows: [], error: "ALIXSMART_EXPORT_KEY missing" };
  }
  const url = `${EXPORT_URL}?table=${encodeURIComponent(table)}&limit=${limit}&offset=${offset}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "x-alix-export-key": EXPORT_KEY,
        "Content-Type": "application/json",
      },
    });
    const txt = await res.text();
    if (!res.ok) return { rows: [], error: `HTTP ${res.status}: ${txt.slice(0, 300)}` };
    let json: any;
    try {
      json = JSON.parse(txt);
    } catch {
      const compact = txt.replace(/\s+/g, " ").trim().slice(0, 300);
      const hint = compact.toLowerCase().includes("<html")
        ? "Remote endpoint returned HTML instead of JSON"
        : "Remote endpoint returned non-JSON response";
      return {
        rows: [],
        error: `${hint}: ${compact || "empty response"}`,
      };
    }
    const rows = Array.isArray(json) ? json : json.rows || json.data || [];
    return { rows, total: json.total };
  } catch (e) {
    return { rows: [], error: (e as Error).message };
  }
}

async function logAction(
  ctx: Ctx,
  source_table: string | null,
  action: string,
  status: string,
  counts: { processed: number; success: number; failed: number },
  error_message?: string,
  metadata?: any,
) {
  await ctx.admin.from("alixsmart_migration_logs").insert({
    migration_batch_id: ctx.batchId,
    source_table,
    action,
    status,
    rows_processed: counts.processed,
    rows_success: counts.success,
    rows_failed: counts.failed,
    error_message: error_message ?? null,
    metadata: metadata ?? null,
  });
}

async function recordMap(
  ctx: Ctx,
  source_table: string,
  source_id: string,
  target_table: string,
  target_id: string | null,
  match_key: string,
  status: string,
  conflict?: string | null,
  error?: string | null,
  metadata?: any,
) {
  await ctx.admin.from("alixsmart_migration_map").upsert(
    {
      source_table,
      source_id,
      target_table,
      target_id,
      match_key,
      migration_status: status,
      conflict_status: conflict ?? null,
      error_message: error ?? null,
      metadata: metadata ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "source_table,source_id" },
  );
}

// --- Per-table importers --------------------------------------------------

async function importProfiles(ctx: Ctx, rows: any[], dryRun: boolean) {
  let s = 0,
    f = 0;
  for (const r of rows) {
    const email = String(r.email || "").toLowerCase().trim();
    const sourceId = String(r.id ?? r.source_id ?? email);
    if (!email) {
      f++;
      await recordMap(ctx, "profiles", sourceId, "user_profiles", null, "email",
        "skipped", "missing_email", "missing email");
      continue;
    }
    const { data: existing } = await ctx.admin
      .from("user_profiles")
      .select("id,email,full_name")
      .ilike("email", email)
      .maybeSingle();
    if (dryRun) {
      await recordMap(
        ctx, "profiles", sourceId, "user_profiles",
        existing?.id ?? null, "email",
        existing ? "dry_run_match" : "dry_run_new",
        existing ? "duplicate_email" : null, null, { email },
      );
      s++;
      continue;
    }
    if (existing) {
      // Only fill empty AlixWork fields
      const patch: any = {};
      if (!existing.full_name && r.full_name) patch.full_name = r.full_name;
      if (Object.keys(patch).length) {
        await ctx.admin.from("user_profiles").update(patch).eq("id", existing.id);
      }
      await recordMap(ctx, "profiles", sourceId, "user_profiles", existing.id,
        "email", "merged", "duplicate_email", null, { patch });
      s++;
    } else {
      // We do not create auth users here – store as conflict
      await recordMap(ctx, "profiles", sourceId, "user_profiles", null,
        "email", "conflict", "needs_auth_user",
        "user_profiles requires matching auth.users id – create user manually first",
        { email, full_name: r.full_name });
      f++;
    }
  }
  return { s, f };
}

async function importUserRoles(ctx: Ctx, rows: any[], dryRun: boolean) {
  let s = 0,
    f = 0;
  // Cache role name → id
  const { data: roles } = await ctx.admin.from("roles").select("id,name");
  const rolesByName = new Map((roles || []).map((r: any) => [r.name, r.id]));
  for (const r of rows) {
    const srcRole = String(r.role || r.role_name || "").toLowerCase();
    const targetRoleName = ROLE_MAP[srcRole] || null;
    const sourceId = String(r.id ?? r.source_id ?? `${r.user_id}-${srcRole}`);
    if (!targetRoleName || !rolesByName.has(targetRoleName)) {
      await recordMap(ctx, "user_roles", sourceId, "user_roles", null,
        "user_id+role", "conflict", "role_not_found",
        `Role mapping missing for "${srcRole}"`, { srcRole });
      f++;
      continue;
    }
    // Resolve user via email in profile
    const email = String(r.user_email || r.email || "").toLowerCase();
    let userId: string | null = null;
    if (email) {
      const { data: up } = await ctx.admin
        .from("user_profiles").select("id").ilike("email", email).maybeSingle();
      userId = up?.id ?? null;
    }
    if (!userId) {
      await recordMap(ctx, "user_roles", sourceId, "user_roles", null,
        "user_id+role", "conflict", "user_not_found",
        "No matching user_profiles row by email", { email, srcRole });
      f++;
      continue;
    }
    if (dryRun) {
      await recordMap(ctx, "user_roles", sourceId, "user_roles", null,
        "user_id+role", "dry_run_ok", null, null,
        { userId, roleName: targetRoleName });
      s++;
      continue;
    }
    const roleId = rolesByName.get(targetRoleName)!;
    const { error } = await ctx.admin.from("user_roles").upsert(
      { user_id: userId, role_id: roleId },
      { onConflict: "user_id,role_id", ignoreDuplicates: true },
    );
    if (error) {
      f++;
      await recordMap(ctx, "user_roles", sourceId, "user_roles", null,
        "user_id+role", "error", null, error.message);
    } else {
      s++;
      await recordMap(ctx, "user_roles", sourceId, "user_roles", userId,
        "user_id+role", "imported", null, null,
        { roleName: targetRoleName });
    }
  }
  return { s, f };
}

async function importDevices(ctx: Ctx, rows: any[], dryRun: boolean) {
  let s = 0,
    f = 0;
  for (const r of rows) {
    const serial = String(r.serial_number || r.serial || "").trim();
    const sourceId = String(r.id ?? r.source_id ?? serial);
    if (!serial) {
      await recordMap(ctx, "devices", sourceId, "lager_devices", null,
        "serial_number", "skipped", "missing_serial");
      f++;
      continue;
    }
    const { data: existing } = await ctx.admin
      .from("lager_devices")
      .select("id,model_name,customer_email,customer_name,device_status,commissioning_date,last_service_date,next_service_date,alixsmart_metadata")
      .eq("serial_number", serial)
      .maybeSingle();

    if (dryRun) {
      await recordMap(ctx, "devices", sourceId, "lager_devices",
        existing?.id ?? null, "serial_number",
        existing ? "dry_run_match" : "dry_run_new", null, null, { serial });
      s++;
      continue;
    }

    const meta = { ...(existing?.alixsmart_metadata ?? {}), source: r };
    if (existing) {
      const patch: any = { alixsmart_source_id: sourceId, alixsmart_metadata: meta };
      if (!existing.model_name && r.model_name) patch.model_name = r.model_name;
      if (!existing.customer_email && r.customer_email)
        patch.customer_email = r.customer_email;
      if (!existing.customer_name && r.customer_name)
        patch.customer_name = r.customer_name;
      if (!existing.device_status && r.status) patch.device_status = r.status;
      if (!existing.commissioning_date && r.commissioning_date)
        patch.commissioning_date = r.commissioning_date;
      if (!existing.last_service_date && r.last_service_date)
        patch.last_service_date = r.last_service_date;
      if (!existing.next_service_date && r.next_service_date)
        patch.next_service_date = r.next_service_date;
      const { error } = await ctx.admin
        .from("lager_devices").update(patch).eq("id", existing.id);
      if (error) {
        f++;
        await recordMap(ctx, "devices", sourceId, "lager_devices", existing.id,
          "serial_number", "error", null, error.message);
      } else {
        s++;
        await recordMap(ctx, "devices", sourceId, "lager_devices", existing.id,
          "serial_number", "merged", "duplicate_serial", null, { patch });
      }
    } else {
      const { data: ins, error } = await ctx.admin
        .from("lager_devices").insert({
          serial_number: serial,
          model_name: r.model_name ?? null,
          customer_email: r.customer_email ?? null,
          customer_name: r.customer_name ?? null,
          device_status: r.status ?? null,
          commissioning_date: r.commissioning_date ?? null,
          last_service_date: r.last_service_date ?? null,
          next_service_date: r.next_service_date ?? null,
          alixsmart_source_id: sourceId,
          source_system: "alixsmart",
          alixsmart_metadata: meta,
        }).select("id").maybeSingle();
      if (error) {
        f++;
        await recordMap(ctx, "devices", sourceId, "lager_devices", null,
          "serial_number", "error", null, error.message);
      } else {
        s++;
        await recordMap(ctx, "devices", sourceId, "lager_devices",
          ins?.id ?? null, "serial_number", "imported");
      }
    }
  }
  return { s, f };
}

// Generic upsert by `source_id`
async function importGeneric(
  ctx: Ctx,
  sourceTable: string,
  targetTable: string,
  rows: any[],
  dryRun: boolean,
  shape?: (r: any) => Record<string, any>,
) {
  let s = 0,
    f = 0;
  for (const r of rows) {
    const sourceId = String(r.id ?? r.source_id ?? "");
    if (!sourceId) {
      f++;
      await recordMap(ctx, sourceTable, "(no-id)", targetTable, null,
        "source_id", "skipped", "missing_id");
      continue;
    }
    if (dryRun) {
      const { data: existing } = await ctx.admin
        .from(targetTable as any).select("id").eq("source_id", sourceId).maybeSingle();
      await recordMap(ctx, sourceTable, sourceId, targetTable,
        existing?.id ?? null, "source_id",
        existing ? "dry_run_match" : "dry_run_new");
      s++;
      continue;
    }
    const payload = shape
      ? shape(r)
      : { ...r, source_id: sourceId, metadata: { source: r } };
    // Drop fields that probably don't exist in target
    delete (payload as any).id;
    const { data, error } = await ctx.admin
      .from(targetTable as any)
      .upsert(payload, { onConflict: "source_id" })
      .select("id").maybeSingle();
    if (error) {
      f++;
      await recordMap(ctx, sourceTable, sourceId, targetTable, null,
        "source_id", "error", null, error.message);
    } else {
      s++;
      await recordMap(ctx, sourceTable, sourceId, targetTable,
        data?.id ?? null, "source_id", "imported");
    }
  }
  return { s, f };
}

async function importSuppressed(ctx: Ctx, rows: any[], dryRun: boolean) {
  let s = 0,
    f = 0;
  for (const r of rows) {
    const email = String(r.email || "").toLowerCase().trim();
    const sourceId = String(r.id ?? email);
    if (!email) {
      f++;
      await recordMap(ctx, "suppressed_emails", sourceId, "suppressed_emails",
        null, "email", "skipped", "missing_email");
      continue;
    }
    if (dryRun) {
      const { data: existing } = await ctx.admin
        .from("suppressed_emails").select("id").eq("email", email).maybeSingle();
      await recordMap(ctx, "suppressed_emails", sourceId, "suppressed_emails",
        existing?.id ?? null, "email",
        existing ? "dry_run_match" : "dry_run_new");
      s++;
      continue;
    }
    const { data, error } = await ctx.admin.from("suppressed_emails")
      .upsert(
        { email, reason: r.reason ?? null, source_system: "alixsmart",
          source_id: sourceId, metadata: { source: r } },
        { onConflict: "email" },
      ).select("id").maybeSingle();
    if (error) {
      f++;
      await recordMap(ctx, "suppressed_emails", sourceId, "suppressed_emails",
        null, "email", "error", null, error.message);
    } else {
      s++;
      await recordMap(ctx, "suppressed_emails", sourceId, "suppressed_emails",
        data?.id ?? null, "email", "imported");
    }
  }
  return { s, f };
}

// Dispatcher
async function importOne(
  ctx: Ctx,
  sourceTable: string,
  rows: any[],
  dryRun: boolean,
): Promise<{ s: number; f: number }> {
  const m = TABLE_MAP[sourceTable];
  if (!m) return { s: 0, f: rows.length };

  switch (sourceTable) {
    case "profiles":
      return importProfiles(ctx, rows, dryRun);
    case "user_roles":
      return importUserRoles(ctx, rows, dryRun);
    case "devices":
      return importDevices(ctx, rows, dryRun);
    case "suppressed_emails":
      return importSuppressed(ctx, rows, dryRun);
    case "products":
      return importGeneric(ctx, sourceTable, "alixsmart_products", rows, dryRun,
        (r) => ({
          source_id: String(r.id ?? r.source_id),
          sku: r.sku ?? null, name: r.name ?? null,
          description: r.description ?? null, category: r.category ?? null,
          price: r.price ?? null, currency: r.currency ?? null,
          is_active: r.is_active ?? true, metadata: { source: r },
        }));
    case "model_manuals":
      return importGeneric(ctx, sourceTable, "model_manuals", rows, dryRun,
        (r) => ({
          source_id: String(r.id ?? r.source_id),
          model_name: r.model_name ?? null, title: r.title ?? null,
          file_url: r.file_url ?? r.url ?? null,
          file_type: r.file_type ?? null, version: r.version ?? null,
          is_active: r.is_active ?? true, metadata: { source: r },
        }));
    case "support_videos":
      return importGeneric(ctx, sourceTable, "support_videos", rows, dryRun,
        (r) => ({
          source_id: String(r.id ?? r.source_id),
          title: r.title ?? null, description: r.description ?? null,
          video_url: r.video_url ?? r.url ?? null,
          thumbnail_url: r.thumbnail_url ?? null,
          category: r.category ?? null, device_model: r.device_model ?? null,
          is_active: r.is_active ?? true, metadata: { source: r },
        }));
    case "customer_notes":
      return importGeneric(ctx, sourceTable, "customer_notes", rows, dryRun,
        (r) => ({
          source_id: String(r.id ?? r.source_id),
          source_customer_id: r.customer_id ? String(r.customer_id) : null,
          customer_email: r.customer_email ?? null,
          customer_name: r.customer_name ?? null,
          note: r.note ?? r.text ?? "",
          is_internal: r.is_internal ?? false,
          metadata: { source: r },
        }));
    case "maintenance_confirmations":
      return importGeneric(ctx, sourceTable, "maintenance_confirmations", rows,
        dryRun, (r) => ({
          source_id: String(r.id ?? r.source_id),
          source_device_id: r.device_id ? String(r.device_id) : null,
          serial_number: r.serial_number ?? null,
          customer_name: r.customer_name ?? null,
          confirmation_date: r.confirmation_date ?? r.date ?? null,
          signature_url: r.signature_url ?? null,
          document_url: r.document_url ?? null,
          notes: r.notes ?? null,
          metadata: { source: r },
        }));
    case "academy_sessions":
      return importGeneric(ctx, sourceTable, "academy_sessions", rows, dryRun,
        (r) => ({
          source_id: String(r.id ?? r.source_id),
          title: r.title ?? "", description: r.description ?? null,
          start_date: r.start_date ?? null, end_date: r.end_date ?? null,
          location: r.location ?? null, instructor: r.instructor ?? null,
          max_participants: r.max_participants ?? null,
          status: r.status ?? null, metadata: { source: r },
        }));
    case "academy_bookings":
      return importGeneric(ctx, sourceTable, "academy_bookings", rows, dryRun,
        (r) => ({
          source_id: String(r.id ?? r.source_id),
          source_session_id: r.session_id ? String(r.session_id) : null,
          source_customer_id: r.customer_id ? String(r.customer_id) : null,
          customer_name: r.customer_name ?? null,
          customer_email: r.customer_email ?? null,
          booking_status: r.booking_status ?? r.status ?? null,
          notes: r.notes ?? null, metadata: { source: r },
        }));
    case "internal_messages":
      return importGeneric(ctx, sourceTable, "mail_internal_messages", rows,
        dryRun, (r) => ({
          source_id: String(r.id ?? r.source_id),
          subject: r.subject ?? "", body: r.body ?? r.message ?? "",
          is_read: r.is_read ?? false,
        }));
    case "email_unsubscribe_tokens":
      return importGeneric(ctx, sourceTable, "email_unsubscribe_tokens", rows,
        dryRun);
    case "audit_logs":
      // Treat as fire-and-forget; deduped by source_id stored in details
      return importGeneric(ctx, sourceTable, "audit_logs", rows, dryRun,
        (r) => ({
          action: r.action ?? "import",
          module: r.module ?? "alixsmart",
          record_id: r.record_id ?? null,
          details: { source: r, source_id: r.id },
        }));
    case "email_send_log":
      return importGeneric(ctx, sourceTable, "email_send_log", rows, dryRun,
        (r) => ({
          source_id: String(r.id ?? r.source_id),
          recipient_email: r.recipient_email ?? r.to ?? null,
          subject: r.subject ?? null, template: r.template ?? null,
          status: r.status ?? null,
          provider_message_id: r.provider_message_id ?? r.message_id ?? null,
          source_system: "alixsmart",
          sent_at: r.sent_at ?? null,
          metadata: { source: r },
        }));
    default:
      return { s: 0, f: rows.length };
  }
}

async function importTablePaged(
  ctx: Ctx,
  sourceTable: string,
  dryRun: boolean,
): Promise<{ processed: number; success: number; failed: number; error?: string }> {
  if (FORBIDDEN.has(sourceTable))
    return { processed: 0, success: 0, failed: 0, error: "table_forbidden" };
  if (!TABLE_MAP[sourceTable])
    return { processed: 0, success: 0, failed: 0, error: "table_not_mapped" };

  let offset = 0;
  const limit = 100;
  let processed = 0,
    success = 0,
    failed = 0;
  // hard cap: 50 pages = 5000 rows per call
  for (let page = 0; page < 50; page++) {
    const { rows, error } = await fetchTable(sourceTable, limit, offset);
    if (error) {
      await logAction(ctx, sourceTable, dryRun ? "dry_run" : "import",
        "error", { processed, success, failed }, error);
      return { processed, success, failed, error };
    }
    if (!rows.length) break;
    const { s, f } = await importOne(ctx, sourceTable, rows, dryRun);
    processed += rows.length;
    success += s;
    failed += f;
    if (rows.length < limit) break;
    offset += limit;
  }
  await logAction(ctx, sourceTable, dryRun ? "dry_run" : "import",
    failed === 0 ? "success" : "partial",
    { processed, success, failed });
  return { processed, success, failed };
}

// --- HTTP handler ---------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supaUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claims.claims.sub as string;
    const admin = createClient(supaUrl, serviceKey);

    // Role check: Super Admin or Admin
    const { data: roleRows } = await admin
      .from("user_roles")
      .select("roles(name)")
      .eq("user_id", userId);
    const roles = (roleRows || []).map((r: any) => r.roles?.name).filter(Boolean);
    if (!roles.includes("Super Admin") && !roles.includes("Admin")) {
      return new Response(JSON.stringify({ error: "Forbidden – admin only" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action: string = body.action || "test-connection";
    const batchId: string = body.batch_id || `${action}-${Date.now()}`;
    const ctx: Ctx = { admin, userId, batchId };

    if (action === "test-connection") {
      const r = await fetchTable("profiles", 1, 0);
      const ok = !r.error;
      await logAction(ctx, null, "test_connection", ok ? "success" : "error",
        { processed: 0, success: 0, failed: 0 }, r.error);
      return new Response(JSON.stringify({
        ok, sample_count: r.rows.length, error: r.error, url: EXPORT_URL,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "fetch-table") {
      const table = String(body.table || "");
      const limit = Math.min(100, Number(body.limit ?? 100));
      const offset = Number(body.offset ?? 0);
      if (FORBIDDEN.has(table)) {
        return new Response(JSON.stringify({ error: "table_forbidden" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const r = await fetchTable(table, limit, offset);
      return new Response(JSON.stringify(r),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "dry-run-import" || action === "import-wave") {
      const wave = Number(body.wave ?? 1) as 1 | 2 | 3 | 4;
      const dryRun = action === "dry-run-import" || !!body.dry_run;
      const tables = Object.entries(TABLE_MAP)
        .filter(([, v]) => v.wave === wave)
        .map(([k]) => k);
      const results: Record<string, any> = {};
      for (const t of tables) {
        results[t] = await importTablePaged(ctx, t, dryRun);
      }
      await logAction(ctx, null, action,
        Object.values(results).every((r: any) => !r.error) ? "success" : "partial",
        {
          processed: Object.values(results).reduce((a: number, r: any) => a + r.processed, 0),
          success: Object.values(results).reduce((a: number, r: any) => a + r.success, 0),
          failed: Object.values(results).reduce((a: number, r: any) => a + r.failed, 0),
        }, undefined, { wave, dryRun, tables });
      return new Response(JSON.stringify({ batch_id: batchId, wave, dryRun, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "import-table") {
      const table = String(body.table || "");
      const dryRun = !!body.dry_run;
      const r = await importTablePaged(ctx, table, dryRun);
      return new Response(JSON.stringify({ batch_id: batchId, table, dryRun, ...r }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "rollback-info") {
      const { data } = await admin
        .from("alixsmart_migration_map")
        .select("source_table,target_table,migration_status")
        .order("created_at", { ascending: false }).limit(1000);
      const summary: Record<string, Record<string, number>> = {};
      for (const r of (data || []) as any[]) {
        const key = `${r.source_table}→${r.target_table}`;
        summary[key] = summary[key] || {};
        summary[key][r.migration_status] = (summary[key][r.migration_status] || 0) + 1;
      }
      return new Response(JSON.stringify({ summary, note: "No automatic delete." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "unknown_action", action }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
