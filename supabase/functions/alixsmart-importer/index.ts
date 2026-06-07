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
  user: "Order",
};

/** Source roles that intentionally do NOT receive a backend role assignment.
 *  Users are imported as customer profile only (no user_roles row). */
const CUSTOMER_ONLY_ROLES = new Set(["customer", "kunde", "client"]);

interface Ctx {
  admin: ReturnType<typeof createClient>;
  userId: string;
  batchId: string;
  /** target table -> cached column list */
  schemaCache: Map<string, string[]>;
}

/** Read public table columns via SECURITY DEFINER helper. Returns []
 *  on error so the importer can continue without exploding. */
async function getTargetColumns(ctx: Ctx, table: string): Promise<string[]> {
  if (ctx.schemaCache.has(table)) return ctx.schemaCache.get(table)!;
  try {
    const { data, error } = await ctx.admin.rpc("get_table_columns", {
      _table: table,
    });
    const cols = !error && Array.isArray(data) ? (data as string[]) : [];
    ctx.schemaCache.set(table, cols);
    return cols;
  } catch {
    ctx.schemaCache.set(table, []);
    return [];
  }
}

/** Drop keys that don't exist in the target table. Returns sanitized
 *  payload + the names of skipped keys. */
function sanitizePayload<T extends Record<string, any>>(
  payload: T,
  allowed: string[],
): { clean: Partial<T>; skipped: string[] } {
  if (!allowed.length) return { clean: payload, skipped: [] };
  const set = new Set(allowed);
  const clean: Record<string, any> = {};
  const skipped: string[] = [];
  for (const [k, v] of Object.entries(payload)) {
    if (set.has(k)) clean[k] = v;
    else skipped.push(k);
  }
  return { clean: clean as Partial<T>, skipped };
}

/** Collect every unique key from a sample of source rows. */
function sourceColumns(rows: any[], sampleSize = 25): string[] {
  const set = new Set<string>();
  for (const r of rows.slice(0, sampleSize)) {
    if (r && typeof r === "object")
      Object.keys(r).forEach((k) => set.add(k));
  }
  return [...set].sort();
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
    const rawRows = Array.isArray(json) ? json : json.rows || json.data || [];
    // The remote export wraps every row in an envelope
    // { source_table, source_id, payload, created_at, updated_at }.
    // Unwrap it so downstream importers see the flat record.
    const rows = rawRows.map((r: any) => {
      if (r && typeof r === "object" && "payload" in r && r.payload && typeof r.payload === "object") {
        return {
          ...r.payload,
          source_id: r.source_id ?? r.payload.id ?? null,
          _envelope: { source_table: r.source_table, created_at: r.created_at, updated_at: r.updated_at },
        };
      }
      return r;
    });
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

// Statuses that represent a final/explicit decision (user-resolved or already imported)
// and must NOT be overwritten by re-runs of analyze / dry-run / import.
const PROTECTED_STATUSES = new Set([
  "pending_new_profile",
  "pending_new_device",
  "match_confirmed",
  "match_rejected",
  "imported",
  "merged",
  "imported_customer_profile_only",
]);

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
  // Preserve protected (user-decided / final) rows: skip overwrite unless the new
  // status is itself protected (e.g. import promoting pending → imported).
  try {
    const { data: existing } = await ctx.admin
      .from("alixsmart_migration_map")
      .select("migration_status")
      .eq("source_table", source_table)
      .eq("source_id", source_id)
      .maybeSingle();
    if (
      existing &&
      PROTECTED_STATUSES.has(existing.migration_status) &&
      !PROTECTED_STATUSES.has(status)
    ) {
      return; // keep prior user/import decision
    }
  } catch { /* fall through to upsert */ }

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
      // No matching auth.users / user_profiles → mark as pending_new_profile.
      // These rows will be created as customer-only records (no auth user needed).
      await recordMap(ctx, "profiles", sourceId, "user_profiles", null,
        "email", "pending_new_profile", "open",
        null,
        { email, full_name: r.full_name, note: "Wird als Kundenprofil angelegt (kein Auth-User nötig)" });
      s++;
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
    const srcRole = String(r.role || r.role_name || "").toLowerCase().trim();
    const sourceId = String(r.id ?? r.source_id ?? `${r.user_id}-${srcRole}`);
    if (CUSTOMER_ONLY_ROLES.has(srcRole)) {
      await recordMap(ctx, "user_roles", sourceId, "user_roles", null,
        "user_id+role", "imported_customer_profile_only", null, null,
        { srcRole, note: "Kein Backend-Rollen-Mapping – nur Kundenprofil" });
      s++;
      continue;
    }
    const targetRoleName = ROLE_MAP[srcRole] || null;
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
      // Orphan role assignment (user existed once in AlixSmart, profile gone).
      // Skip cleanly instead of marking as conflict.
      await recordMap(ctx, "user_roles", sourceId, "user_roles", null,
        "user_id+role", "skipped", "user_not_found",
        "Verwaiste Rolle: kein passender User – übersprungen", { email, srcRole });
      s++;
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
      // Ensure NOT NULL fields in lager_devices have a fallback
      const fallbackModel =
        r.model_name ||
        r.device_name ||
        r.model ||
        r.product_name ||
        "Unbekanntes Gerät";
      const { data: ins, error } = await ctx.admin
        .from("lager_devices").insert({
          serial_number: serial,
          model_name: fallbackModel,
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
  const targetCols = await getTargetColumns(ctx, targetTable);
  const hasSourceId = targetCols.length === 0 || targetCols.includes("source_id");
  const skippedAll = new Set<string>();
  for (const r of rows) {
    const sourceId = String(r.id ?? r.source_id ?? "");
    if (!sourceId) {
      f++;
      await recordMap(ctx, sourceTable, "(no-id)", targetTable, null,
        "source_id", "skipped", "missing_id");
      continue;
    }
    if (dryRun) {
      let existing: any = null;
      if (hasSourceId) {
        const res = await ctx.admin
          .from(targetTable as any).select("id").eq("source_id", sourceId).maybeSingle();
        existing = res.data;
      }
      await recordMap(ctx, sourceTable, sourceId, targetTable,
        existing?.id ?? null, "source_id",
        existing ? "dry_run_match" : "dry_run_new");
      s++;
      continue;
    }
    const rawPayload = shape
      ? shape(r)
      : { ...r, source_id: sourceId, metadata: { source: r } };
    delete (rawPayload as any).id;
    const { clean: payload, skipped } = sanitizePayload(rawPayload, targetCols);
    skipped.forEach((k) => skippedAll.add(k));
    if (!Object.keys(payload).length) {
      f++;
      await recordMap(ctx, sourceTable, sourceId, targetTable, null,
        "source_id", "error", null, "no_matching_target_columns",
        { skipped });
      continue;
    }
    const upsertOpts: any = hasSourceId ? { onConflict: "source_id" } : undefined;
    const q = ctx.admin.from(targetTable as any);
    const op = hasSourceId
      ? q.upsert(payload, upsertOpts).select("id").maybeSingle()
      : q.insert(payload).select("id").maybeSingle();
    const { data, error } = await op;
    if (error) {
      f++;
      await recordMap(ctx, sourceTable, sourceId, targetTable, null,
        "source_id", "error", null, error.message, { skipped });
    } else {
      s++;
      await recordMap(ctx, sourceTable, sourceId, targetTable,
        data?.id ?? null, "source_id", "imported", null, null,
        skipped.length ? { skipped } : undefined);
    }
  }
  return { s, f, skippedCols: [...skippedAll] };
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
          booking_status: r.booking_status ?? r.status ?? "booked",
          notes: r.notes ?? null, metadata: { source: r },
        }));
    case "internal_messages": {
      // Preload profile-id mapping (alixsmart_id -> user_profiles.id)
      const { data: pmap } = await ctx.admin
        .from("alixsmart_migration_map")
        .select("source_id,target_id")
        .eq("source_table", "profiles")
        .in("migration_status", ["imported", "merged"])
        .not("target_id", "is", null);
      const profileMap = new Map<string, string>(
        (pmap ?? []).map((p: any) => [String(p.source_id), p.target_id]),
      );
      return importGeneric(ctx, sourceTable, "mail_internal_messages", rows,
        dryRun, (r) => {
          const senderSrc = String(r.sender_id ?? r.from_user_id ?? r.user_id ?? "");
          const recipientSrc = String(r.recipient_id ?? r.to_user_id ?? "");
          return {
            source_id: String(r.id ?? r.source_id),
            sender_id: profileMap.get(senderSrc) ?? null,
            recipient_user_id: profileMap.get(recipientSrc) ?? null,
            subject: r.subject ?? "",
            body: r.body ?? r.message ?? "",
            is_read: r.is_read ?? false,
            read_at: r.read_at ?? null,
            created_at: r.created_at ?? undefined,
          };
        });
    }
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
): Promise<{
  processed: number; success: number; failed: number; error?: string;
  schema?: {
    target_table: string;
    source_columns: string[];
    target_columns: string[];
    matched_columns: string[];
    skipped_columns: string[];
  };
  error_details?: any;
}> {
  if (FORBIDDEN.has(sourceTable))
    return { processed: 0, success: 0, failed: 0, error: "table_forbidden" };
  const mapEntry = TABLE_MAP[sourceTable];
  if (!mapEntry)
    return { processed: 0, success: 0, failed: 0, error: "table_not_mapped" };

  const targetTable = mapEntry.target;
  const targetColumns = await getTargetColumns(ctx, targetTable);
  const allSourceCols = new Set<string>();
  let offset = 0;
  const limit = 100;
  let processed = 0, success = 0, failed = 0;

  for (let page = 0; page < 50; page++) {
    const { rows, error } = await fetchTable(sourceTable, limit, offset);
    if (error) {
      const m = error.match(/column\s+([\w."]+)\s+does not exist/i);
      const error_details = {
        kind: m ? "upstream_missing_column" : "upstream_fetch_error",
        missing_column: m?.[1] ?? null,
        message: error,
      };
      const src = [...allSourceCols].sort();
      const matched = src.filter((c) => targetColumns.includes(c));
      const skippedCols = src.filter((c) => !targetColumns.includes(c));
      await logAction(ctx, sourceTable, dryRun ? "dry_run" : "import",
        "error", { processed, success, failed }, error, {
          target_table: targetTable, source_columns: src,
          target_columns: targetColumns, matched_columns: matched,
          skipped_columns: skippedCols, error_details,
        });
      return {
        processed, success, failed, error, error_details,
        schema: {
          target_table: targetTable, source_columns: src,
          target_columns: targetColumns, matched_columns: matched,
          skipped_columns: skippedCols,
        },
      };
    }
    if (!rows.length) break;
    sourceColumns(rows).forEach((c) => allSourceCols.add(c));
    const { s, f } = await importOne(ctx, sourceTable, rows, dryRun);
    processed += rows.length;
    success += s;
    failed += f;
    if (rows.length < limit) break;
    offset += limit;
  }

  const src = [...allSourceCols].sort();
  const matched = src.filter((c) => targetColumns.includes(c));
  const skippedCols = src.filter((c) => !targetColumns.includes(c));
  await logAction(ctx, sourceTable, dryRun ? "dry_run" : "import",
    failed === 0 ? "success" : "partial",
    { processed, success, failed }, undefined, {
      target_table: targetTable, source_columns: src,
      target_columns: targetColumns, matched_columns: matched,
      skipped_columns: skippedCols,
    });

  return {
    processed, success, failed,
    schema: {
      target_table: targetTable, source_columns: src,
      target_columns: targetColumns, matched_columns: matched,
      skipped_columns: skippedCols,
    },
  };
}

/** Inspect schema for every mapped source table without importing. */
async function discoverSchemas(ctx: Ctx) {
  const out: Record<string, any> = {};
  for (const [src, m] of Object.entries(TABLE_MAP)) {
    const targetColumns = await getTargetColumns(ctx, m.target);
    const probe = await fetchTable(src, 25, 0);
    if (probe.error) {
      const em = probe.error.match(/column\s+([\w."]+)\s+does not exist/i);
      out[src] = {
        target_table: m.target, target_columns: targetColumns,
        source_columns: [], matched_columns: [], skipped_columns: [],
        fetch_error: probe.error,
        error_details: {
          kind: em ? "upstream_missing_column" : "upstream_fetch_error",
          missing_column: em?.[1] ?? null,
        },
      };
      continue;
    }
    const cols = sourceColumns(probe.rows);
    out[src] = {
      target_table: m.target,
      target_columns: targetColumns,
      source_columns: cols,
      matched_columns: cols.filter((c) => targetColumns.includes(c)),
      skipped_columns: cols.filter((c) => !targetColumns.includes(c)),
      sample_rows: probe.rows.length,
    };
  }
  await logAction(ctx, null, "discover_schema", "success",
    { processed: 0, success: 0, failed: 0 }, undefined, out);
  return out;
}

/** Fetch all pages of a source table (capped) without importing. */
async function fetchAllRows(sourceTable: string, max = 2000): Promise<{ rows: any[]; error?: string }> {
  const out: any[] = [];
  const limit = 100;
  let offset = 0;
  for (let i = 0; i < 50 && out.length < max; i++) {
    const r = await fetchTable(sourceTable, limit, offset);
    if (r.error) return { rows: out, error: r.error };
    if (!r.rows.length) break;
    out.push(...r.rows);
    if (r.rows.length < limit) break;
    offset += limit;
  }
  return { rows: out };
}

/** Read-only conflict analysis for Welle 1 (profiles, user_roles, devices). */
async function analyzeWave1(ctx: Ctx) {
  // =================== profiles ===================
  const profilesRes = await fetchAllRows("profiles");

  // Load target customers (used for the 5 match rules)
  const { data: allCustomers } = await ctx.admin
    .from("customers")
    .select("id,company_name,contact_name,email,phone,billing_address");

  const norm = (s: any) => String(s ?? "").toLowerCase().trim();
  const normPhone = (s: any) => String(s ?? "").replace(/[^\d+]/g, "");

  const byEmail = new Map<string, any>();
  const byPhone = new Map<string, any>();
  const byCompanyZip = new Map<string, any>();
  const byCompanyCity = new Map<string, any>();
  (allCustomers || []).forEach((c: any) => {
    if (c.email) byEmail.set(norm(c.email), c);
    const p = normPhone(c.phone);
    if (p) byPhone.set(p, c);
    const zip = c.billing_address?.zip || c.billing_address?.postal_code;
    const city = c.billing_address?.city;
    const comp = norm(c.company_name);
    if (comp && zip) byCompanyZip.set(`${comp}|${String(zip).trim()}`, c);
    if (comp && city) byCompanyCity.set(`${comp}|${norm(city)}`, c);
  });

  const profileItems: any[] = [];
  const profileBuckets: Record<string, number> = {
    secure: 0, suggestion: 0, manual: 0, no_match: 0, missing_email: 0,
  };

  for (const r of profilesRes.rows) {
    const email = norm(r.email);
    const phone = normPhone(r.phone || r.phone_number);
    const mobile = normPhone(r.mobile || r.mobile_number || r.mobile_phone);
    const company = norm(r.company || r.company_name || r.organization);
    const zip = String(r.zip || r.postal_code || r.plz || r.address?.zip || "").trim();
    const city = norm(r.city || r.ort || r.address?.city);
    const sourceId = String(r.id ?? r.source_id ?? email ?? "");

    let target: any = null;
    let confidence = 0;
    let match_rule = "no_match";
    if (email && byEmail.has(email)) { target = byEmail.get(email); confidence = 100; match_rule = "email_exact"; }
    else if (phone && byPhone.has(phone)) { target = byPhone.get(phone); confidence = 95; match_rule = "phone_exact"; }
    else if (mobile && byPhone.has(mobile)) { target = byPhone.get(mobile); confidence = 95; match_rule = "mobile_exact"; }
    else if (company && zip && byCompanyZip.has(`${company}|${zip}`)) { target = byCompanyZip.get(`${company}|${zip}`); confidence = 88; match_rule = "company_zip"; }
    else if (company && city && byCompanyCity.has(`${company}|${city}`)) { target = byCompanyCity.get(`${company}|${city}`); confidence = 82; match_rule = "company_city"; }

    let match_class: "secure" | "suggestion" | "manual" | "no_match";
    if (confidence >= 95) match_class = "secure";
    else if (confidence >= 80) match_class = "suggestion";
    else if (confidence > 0) match_class = "manual";
    else match_class = "no_match";
    if (!email && !phone && !mobile && !company) { match_class = "no_match"; profileBuckets.missing_email++; }
    profileBuckets[match_class]++;

    const import_status =
      match_class === "no_match" && confidence === 0 ? "importable_new_record" : null;

    profileItems.push({
      source_id: sourceId,
      email, phone, mobile, company, zip, city,
      full_name: r.full_name ?? r.name ?? null,
      target_id: target?.id ?? null,
      target_company: target?.company_name ?? null,
      target_contact: target?.contact_name ?? null,
      target_email: target?.email ?? null,
      target_phone: target?.phone ?? null,
      confidence, match_rule, match_class, import_status,
    });
  }


  // ---- user_roles
  const rolesRes = await fetchAllRows("user_roles");
  const { data: targetRoles } = await ctx.admin.from("roles").select("id,name,description");
  const targetRoleList = (targetRoles || []).map((r: any) => ({ name: String(r.name), description: r.description ?? null }));
  const targetRoleNames = targetRoleList.map((r) => r.name);
  const targetByLower = new Map(targetRoleList.map((r) => [r.name.toLowerCase(), r.name]));

  const sourceRoleUsers = new Map<string, Set<string>>();
  const sourceRoleCounts = new Map<string, number>();
  for (const r of rolesRes.rows) {
    const raw = String(r.role || r.role_name || "").toLowerCase().trim();
    if (!raw) continue;
    sourceRoleCounts.set(raw, (sourceRoleCounts.get(raw) || 0) + 1);
    const uid = String(r.user_id ?? r.id ?? "");
    if (!sourceRoleUsers.has(raw)) sourceRoleUsers.set(raw, new Set());
    if (uid) sourceRoleUsers.get(raw)!.add(uid);
  }

  const roleMappings: Array<{
    source: string; user_count: number; assignment_count: number;
    suggested_target: string | null;
    status: "auto" | "customer_profile_only" | "manual" | "blocked";
    reason: string;
  }> = [];
  const unmapped = new Set<string>();
  const mappingSuggestion: Record<string, string | null> = {};
  for (const [raw, count] of sourceRoleCounts.entries()) {
    let suggested: string | null = null;
    let status: "auto" | "customer_profile_only" | "manual" | "blocked" = "blocked";
    let reason = "Kein Mapping – neue Zielrolle vorschlagen";

    if (CUSTOMER_ONLY_ROLES.has(raw)) {
      suggested = null;
      status = "customer_profile_only";
      reason = "Kundenprofil ohne Backend-Rolle (kein user_roles-Eintrag)";
    } else {
      const mapHit = ROLE_MAP[raw];
      const exactHit = targetByLower.get(raw);
      if (mapHit && targetByLower.has(mapHit.toLowerCase())) {
        suggested = targetByLower.get(mapHit.toLowerCase())!;
        status = "auto";
        reason = `Automatisch über ROLE_MAP: ${raw} → ${suggested}`;
      } else if (exactHit) {
        suggested = exactHit;
        status = "auto";
        reason = "Exakter Namensmatch (case-insensitive)";
      } else {
        const fuzzy = targetRoleNames.find((n) =>
          n.toLowerCase().includes(raw) || raw.includes(n.toLowerCase())
        );
        if (fuzzy) {
          suggested = fuzzy;
          status = "manual";
          reason = `Fuzzy-Vorschlag: ${raw} ≈ ${fuzzy} – bitte prüfen`;
        } else {
          unmapped.add(raw);
          status = "blocked";
        }
      }
    }
    mappingSuggestion[raw] = suggested;
    roleMappings.push({
      source: raw,
      user_count: sourceRoleUsers.get(raw)?.size || 0,
      assignment_count: count,
      suggested_target: suggested,
      status,
      reason,
    });
  }

  const roleStatusCounts = {
    auto: roleMappings.filter((m) => m.status === "auto").length,
    customer_profile_only: roleMappings.filter((m) => m.status === "customer_profile_only").length,
    manual: roleMappings.filter((m) => m.status === "manual").length,
    blocked: roleMappings.filter((m) => m.status === "blocked").length,
  };

  // Aggregated user counts for summary
  const roleUserAggregates = {
    customer_profiles: roleMappings.filter(m => m.status === 'customer_profile_only').reduce((a, m) => a + m.user_count, 0),
    staff: roleMappings.filter(m => m.status === 'auto' && m.suggested_target && m.suggested_target !== 'Admin' && m.suggested_target !== 'Super Admin').reduce((a, m) => a + m.user_count, 0),
    admins: roleMappings.filter(m => m.status === 'auto' && (m.suggested_target === 'Admin' || m.suggested_target === 'Super Admin')).reduce((a, m) => a + m.user_count, 0),
  };

  // =================== devices ===================
  const devicesRes = await fetchAllRows("devices");
  const normSerial = (s: any) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

  const { data: allDevices } = await ctx.admin
    .from("lager_devices")
    .select("id,serial_number,model_name,customer_email,customer_name");

  const devBySerial = new Map<string, any>();
  const devBySerialNorm = new Map<string, any>();
  const devBySerialModel = new Map<string, any>();
  const devByCustomerModel = new Map<string, any>();
  (allDevices || []).forEach((d: any) => {
    const s = String(d.serial_number || "").trim();
    if (s) devBySerial.set(s, d);
    const sn = normSerial(s);
    if (sn) devBySerialNorm.set(sn, d);
    const mdl = norm(d.model_name);
    if (sn && mdl) devBySerialModel.set(`${sn}|${mdl}`, d);
    const cust = norm(d.customer_email || d.customer_name);
    if (cust && mdl) devByCustomerModel.set(`${cust}|${mdl}`, d);
  });

  const deviceItems: any[] = [];
  const deviceBuckets: Record<string, number> = { secure: 0, suggestion: 0, manual: 0, no_match: 0 };

  for (const r of devicesRes.rows) {
    const serial = String(r.serial_number || r.serial || "").trim();
    const sNorm = normSerial(serial);
    const model = norm(r.model_name || r.device_name || r.model);
    const customer = norm(r.customer_email || r.customer_name);
    const sourceId = String(r.id ?? r.source_id ?? serial ?? "");

    let target: any = null;
    let confidence = 0;
    let match_rule = "no_match";
    if (serial && devBySerial.has(serial)) { target = devBySerial.get(serial); confidence = 100; match_rule = "serial_exact"; }
    else if (sNorm && devBySerialNorm.has(sNorm)) { target = devBySerialNorm.get(sNorm); confidence = 95; match_rule = "serial_normalized"; }
    else if (sNorm && model && devBySerialModel.has(`${sNorm}|${model}`)) { target = devBySerialModel.get(`${sNorm}|${model}`); confidence = 88; match_rule = "serial_model"; }
    else if (customer && model && devByCustomerModel.has(`${customer}|${model}`)) { target = devByCustomerModel.get(`${customer}|${model}`); confidence = 75; match_rule = "customer_model"; }

    let match_class: "secure" | "suggestion" | "manual" | "no_match";
    if (confidence >= 95) match_class = "secure";
    else if (confidence >= 80) match_class = "suggestion";
    else if (confidence > 0) match_class = "manual";
    else match_class = "no_match";
    deviceBuckets[match_class]++;

    const import_status =
      match_class === "no_match" && confidence === 0 ? "importable_new_record" : null;

    deviceItems.push({
      source_id: sourceId,
      serial_number: serial,
      model,
      customer_email: r.customer_email ?? null,
      customer_name: r.customer_name ?? null,
      target_id: target?.id ?? null,
      target_serial: target?.serial_number ?? null,
      target_model: target?.model_name ?? null,
      target_customer: target?.customer_name ?? target?.customer_email ?? null,
      confidence, match_rule, match_class, import_status,
    });
  }

  const profileNewRecord = profileItems.filter((p) => p.import_status === "importable_new_record").length;
  const deviceNewRecord = deviceItems.filter((d) => d.import_status === "importable_new_record").length;

  const summary = {
    profiles: {
      total: profileItems.length,
      secure: profileBuckets.secure,
      suggestion: profileBuckets.suggestion,
      manual: profileBuckets.manual,
      no_match: profileBuckets.no_match,
      new_record: profileNewRecord,
      importable_safe: profileBuckets.secure,
      importable_new_record: profileNewRecord,
      manual_review: profileBuckets.suggestion + profileBuckets.manual,
      blocked: Math.max(0, profileBuckets.no_match - profileNewRecord),
    },
    user_roles: {
      total: rolesRes.rows.length,
      importable_safe: roleMappings.filter(m => m.status === 'auto' || m.status === 'customer_profile_only').reduce((a, m) => a + m.assignment_count, 0),
      manual_review: roleMappings.filter(m => m.status === 'manual').reduce((a, m) => a + m.assignment_count, 0),
      blocked: roleMappings.filter(m => m.status === 'blocked').reduce((a, m) => a + m.assignment_count, 0),
    },
    devices: {
      total: deviceItems.length,
      secure: deviceBuckets.secure,
      suggestion: deviceBuckets.suggestion,
      manual: deviceBuckets.manual,
      no_match: deviceBuckets.no_match,
      new_record: deviceNewRecord,
      importable_safe: deviceBuckets.secure,
      importable_new_record: deviceNewRecord,
      manual_review: deviceBuckets.suggestion + deviceBuckets.manual,
      blocked: Math.max(0, deviceBuckets.no_match - deviceNewRecord),
    },
  };

  await logAction(ctx, null, "analyze_wave1", "success",
    { processed: profileItems.length + rolesRes.rows.length + deviceItems.length, success: 0, failed: 0 },
    profilesRes.error || rolesRes.error || devicesRes.error,
    { profileBuckets, deviceBuckets, unmapped_roles: [...unmapped] });

  return {
    profiles: { items: profileItems, buckets: profileBuckets, fetch_error: profilesRes.error || null },
    user_roles: {
      source_roles: [...sourceRoleCounts.entries()].map(([name, count]) => ({
        name, assignment_count: count, user_count: sourceRoleUsers.get(name)?.size || 0,
      })),
      target_roles: targetRoleList,
      mappings: roleMappings,
      unmapped: [...unmapped],
      mapping_suggestion: mappingSuggestion,
      status_counts: roleStatusCounts,
      user_aggregates: roleUserAggregates,
      fetch_error: rolesRes.error || null,
    },
    devices: { items: deviceItems, buckets: deviceBuckets, fetch_error: devicesRes.error || null },
    summary,
  };
}


/** Target AlixWork tables that must be snapshotted before a wave runs.
 *  Order matters only for display — every table is sampled in parallel. */
const BACKUP_TABLES = [
  "user_profiles",
  "user_roles",
  "lager_devices",
  "alixsmart_products",
  "model_manuals",
  "support_videos",
  "customer_notes",
  "maintenance_confirmations",
  "academy_sessions",
  "academy_bookings",
  "mail_internal_messages",
];
const BACKUP_ROW_LIMIT = 50000;

async function backupBeforeWave(
  ctx: Ctx,
  wave: number,
): Promise<{
  ok: boolean;
  log_id: string | null;
  storage_path: string | null;
  total_rows: number;
  size_bytes: number;
  row_counts: Record<string, number>;
  duration_ms: number;
  error?: string;
}> {
  const startedAt = Date.now();
  const { data: logRow, error: logErr } = await ctx.admin
    .from("migration_backup_logs")
    .insert({
      batch_id: ctx.batchId,
      wave,
      status: "running",
      tables: BACKUP_TABLES,
      created_by: ctx.userId,
    })
    .select("id")
    .single();

  if (logErr || !logRow) {
    return {
      ok: false, log_id: null, storage_path: null,
      total_rows: 0, size_bytes: 0, row_counts: {},
      duration_ms: Date.now() - startedAt,
      error: `backup log insert failed: ${logErr?.message ?? "unknown"}`,
    };
  }
  const logId = (logRow as any).id as string;

  const dump: Record<string, any[]> = {};
  const counts: Record<string, number> = {};
  let totalRows = 0;
  try {
    for (const t of BACKUP_TABLES) {
      const { data, error } = await ctx.admin
        .from(t as any)
        .select("*")
        .limit(BACKUP_ROW_LIMIT);
      if (error) {
        // Table missing or denied → record 0 and continue, don't abort backup
        dump[t] = [];
        counts[t] = 0;
        continue;
      }
      dump[t] = data || [];
      counts[t] = (data || []).length;
      totalRows += counts[t];
    }

    const payload = JSON.stringify({
      version: 1,
      batch_id: ctx.batchId,
      wave,
      created_at: new Date().toISOString(),
      row_counts: counts,
      tables: dump,
    });
    const sizeBytes = new TextEncoder().encode(payload).byteLength;
    const path = `alixsmart-migration/wave-${wave}/${ctx.batchId}.json`;

    const { error: upErr } = await ctx.admin.storage
      .from("backups")
      .upload(path, new Blob([payload], { type: "application/json" }), {
        contentType: "application/json",
        upsert: false,
      });
    if (upErr) throw new Error(`storage upload failed: ${upErr.message}`);

    const durationMs = Date.now() - startedAt;
    await ctx.admin.from("migration_backup_logs").update({
      status: "success",
      finished_at: new Date().toISOString(),
      duration_ms: durationMs,
      storage_path: path,
      row_counts: counts,
      total_rows: totalRows,
      size_bytes: sizeBytes,
    }).eq("id", logId);

    return {
      ok: true, log_id: logId, storage_path: path,
      total_rows: totalRows, size_bytes: sizeBytes,
      row_counts: counts, duration_ms: durationMs,
    };
  } catch (e) {
    const msg = (e as Error).message;
    const durationMs = Date.now() - startedAt;
    await ctx.admin.from("migration_backup_logs").update({
      status: "failed",
      finished_at: new Date().toISOString(),
      duration_ms: durationMs,
      row_counts: counts,
      total_rows: totalRows,
      error_message: msg,
    }).eq("id", logId);
    return {
      ok: false, log_id: logId, storage_path: null,
      total_rows: totalRows, size_bytes: 0, row_counts: counts,
      duration_ms: durationMs, error: msg,
    };
  }
}


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
    const ctx: Ctx = { admin, userId, batchId, schemaCache: new Map() };

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

    if (action === "discover-schema") {
      const schemas = await discoverSchemas(ctx);
      return new Response(JSON.stringify({ batch_id: batchId, schemas }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "analyze-wave1") {
      const result = await analyzeWave1(ctx);
      return new Response(JSON.stringify({ batch_id: batchId, ...result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "resolve-wave1-conflict") {
      // Record a human decision in alixsmart_migration_map.
      // No business data is changed. decision ∈ confirm | reject | new_profile | new_device
      const decision = String(body.decision || "");
      const sourceTable = String(body.source_table || "");
      const sourceId = String(body.source_id || "");
      const targetTable = String(body.target_table || "");
      const targetId = body.target_id ? String(body.target_id) : null;
      const confidence = Number(body.confidence ?? 0);
      const matchRule = String(body.match_rule || "");
      const matchKey = sourceTable === "profiles" ? "profile_match" : "device_match";

      if (!sourceTable || !sourceId || !decision) {
        return new Response(JSON.stringify({ error: "missing_params" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const statusMap: Record<string, string> = {
        confirm: "match_confirmed",
        reject: "match_rejected",
        new_profile: "pending_new_profile",
        new_device: "pending_new_device",
      };
      const migration_status = statusMap[decision] || "unknown_decision";

      const { error } = await ctx.admin.from("alixsmart_migration_map").upsert({
        source_table: sourceTable,
        source_id: sourceId,
        target_table: targetTable || null,
        target_id: decision === "confirm" ? targetId : null,
        match_key: matchKey,
        migration_status,
        conflict_status: decision === "reject" || decision.startsWith("new_") ? "open" : "resolved",
        metadata: { decision, confidence, match_rule: matchRule, by: userId, at: new Date().toISOString() },
      }, { onConflict: "source_table,source_id" });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ ok: true, migration_status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }


    if (action === "materialize-pending-profiles") {
      // Create customers rows for all profiles flagged as pending_new_profile.
      // Fetches fresh upstream profile data to fill name/phone/address.
      const upstream = await fetchAllRows("profiles");
      const bySource = new Map<string, any>();
      for (const r of upstream.rows) {
        const sid = String(r.id ?? r.source_id ?? "");
        if (sid) bySource.set(sid, r);
      }

      const { data: pending, error: pendErr } = await ctx.admin
        .from("alixsmart_migration_map")
        .select("source_id, metadata")
        .eq("source_table", "profiles")
        .eq("migration_status", "pending_new_profile");
      if (pendErr) {
        return new Response(JSON.stringify({ error: pendErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      let created = 0, skipped = 0, failed = 0;
      const errors: any[] = [];
      for (const row of (pending || [])) {
        const sourceId = String(row.source_id);
        const src = bySource.get(sourceId) || {};
        const meta = (row.metadata as any) || {};
        const email = String(src.email || meta.email || "").toLowerCase().trim();
        const full_name = src.full_name || src.name || meta.full_name || null;

        // Skip if a customer with this email already exists
        if (email) {
          const { data: dup } = await ctx.admin
            .from("customers").select("id").ilike("email", email).maybeSingle();
          if (dup) {
            await ctx.admin.from("alixsmart_migration_map").update({
              migration_status: "merged",
              target_table: "customers",
              target_id: dup.id,
              conflict_status: "resolved",
              error_message: null,
              metadata: { ...meta, materialized_to: "customers", reason: "email_already_in_customers" },
              updated_at: new Date().toISOString(),
            }).eq("source_table", "profiles").eq("source_id", sourceId);
            skipped++;
            continue;
          }
        }

        const billing = (src.address && typeof src.address === "object")
          ? src.address
          : (src.zip || src.city || src.street)
            ? { zip: src.zip ?? src.postal_code ?? null, city: src.city ?? src.ort ?? null, street: src.street ?? null }
            : null;

        const { data: ins, error } = await ctx.admin
          .from("customers")
          .insert({
            source_system: "alixsmart",
            external_customer_id: sourceId,
            email: email || null,
            contact_name: full_name,
            company_name: src.company || src.company_name || src.organization || null,
            phone: src.phone || src.phone_number || src.mobile || null,
            billing_address: billing,
            raw_data: { source: src, materialized_from: "alixsmart_profiles", at: new Date().toISOString() },
          })
          .select("id")
          .maybeSingle();

        if (error) {
          failed++;
          errors.push({ sourceId, email, message: error.message });
          await ctx.admin.from("alixsmart_migration_map").update({
            migration_status: "error",
            error_message: error.message,
            updated_at: new Date().toISOString(),
          }).eq("source_table", "profiles").eq("source_id", sourceId);
          continue;
        }

        await ctx.admin.from("alixsmart_migration_map").update({
          migration_status: "imported",
          target_table: "customers",
          target_id: ins?.id ?? null,
          conflict_status: "resolved",
          error_message: null,
          metadata: { ...meta, materialized_to: "customers", at: new Date().toISOString() },
          updated_at: new Date().toISOString(),
        }).eq("source_table", "profiles").eq("source_id", sourceId);
        created++;
      }

      await logAction(ctx, "profiles", "materialize_pending_profiles",
        failed === 0 ? "success" : "partial",
        { processed: (pending?.length || 0), success: created + skipped, failed },
        failed ? `${failed} insert errors` : undefined,
        { created, skipped, failed, errors: errors.slice(0, 20) });

      return new Response(JSON.stringify({
        ok: failed === 0, processed: pending?.length || 0,
        created, skipped, failed, errors: errors.slice(0, 20),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }



    if (action === "backup-before-wave") {
      const wave = Number(body.wave ?? 1);
      const r = await backupBeforeWave(ctx, wave);
      return new Response(JSON.stringify({ batch_id: batchId, wave, backup: r }),
        { status: r.ok ? 200 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "dry-run-import" || action === "import-wave") {
      const startedAt = Date.now();
      const wave = Number(body.wave ?? 1) as 1 | 2 | 3 | 4;
      const dryRun = action === "dry-run-import" || !!body.dry_run;
      const skipBackup = !!body.skip_backup || dryRun;

      // 1) Mandatory backup before live wave 1–3
      let backup: any = null;
      if (!skipBackup && wave >= 1 && wave <= 3) {
        backup = await backupBeforeWave(ctx, wave);
        if (!backup.ok) {
          await logAction(ctx, null, action, "aborted",
            { processed: 0, success: 0, failed: 0 },
            `backup_failed: ${backup.error}`, { wave, backup });
          return new Response(JSON.stringify({
            batch_id: batchId, wave, dryRun, aborted: true,
            reason: "backup_failed", backup, results: {},
            summary: { imported: 0, skipped: 0, conflicts: 0, duration_ms: Date.now() - startedAt },
          }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      // 2) Transactional wave import: abort on first table error
      const tables = Object.entries(TABLE_MAP)
        .filter(([, v]) => v.wave === wave)
        .map(([k]) => k);
      const results: Record<string, any> = {};
      let aborted = false;
      let abortReason: string | null = null;
      for (const t of tables) {
        const res = await importTablePaged(ctx, t, dryRun);
        results[t] = res;
        if (res.error) {
          aborted = true;
          abortReason = `table_failed:${t}:${res.error}`;
          break;
        }
      }

      const imported = Object.values(results).reduce((a: number, r: any) => a + (r.success || 0), 0);
      const failedRows = Object.values(results).reduce((a: number, r: any) => a + (r.failed || 0), 0);
      const processed = Object.values(results).reduce((a: number, r: any) => a + (r.processed || 0), 0);
      const skipped = Math.max(0, processed - imported - failedRows);

      // Count conflicts from migration map for this batch
      let conflicts = 0;
      try {
        const { count } = await ctx.admin
          .from("alixsmart_migration_map")
          .select("*", { count: "exact", head: true })
          .eq("conflict_status", "open");
        conflicts = count ?? 0;
      } catch { /* ignore */ }

      await logAction(ctx, null, action,
        aborted ? "aborted" : (failedRows === 0 ? "success" : "partial"),
        { processed, success: imported, failed: failedRows },
        abortReason ?? undefined, { wave, dryRun, tables, backup });

      return new Response(JSON.stringify({
        batch_id: batchId, wave, dryRun, aborted, reason: abortReason,
        backup, results,
        summary: {
          imported, skipped, conflicts,
          failed: failedRows,
          duration_ms: Date.now() - startedAt,
          batch_id: batchId,
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
