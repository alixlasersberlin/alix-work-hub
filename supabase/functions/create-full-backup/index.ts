import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BACKUP_TABLES = [
  "app_settings",
  "audit_logs",
  "backups_metadata",
  "customers",
  "deleted_customers",
  "departments",
  "finance_records",
  "invoice_workflow_states",
  "lager_devices",
  "login_sessions",
  "order_documents",
  "order_import_logs",
  "order_items",
  "order_notes",
  "order_status_history",
  "orders",
  "production_order_items",
  "production_orders",
  "roles",
  "route_plans",
  "suppliers",
  "user_invitations",
  "user_profiles",
  "user_roles",
  "zoho_invoices",
  "zoho_items",
  "zoho_recurring_invoices",
  "zoho_unpaid_invoices",
];

const STORAGE_BUCKETS = ["production-orders", "production-photos", "order-invoices"];
const DB_PAGE_SIZE = 50;
const STORAGE_LIST_LIMIT = 250;
const encoder = new TextEncoder();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function tick() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function uploadJson(
  adminClient: ReturnType<typeof createClient>,
  path: string,
  payload: unknown,
) {
  const bytes = encoder.encode(JSON.stringify(payload, null, 2));
  const size = bytes.byteLength;
  const { error } = await adminClient.storage.from("backups").upload(path, bytes, {
    contentType: "application/json",
    upsert: false,
  });
  if (error) throw new Error(`Upload ${path}: ${error.message}`);
  return size;
}

async function uploadNdjsonPart(
  adminClient: ReturnType<typeof createClient>,
  path: string,
  rows: Record<string, unknown>[],
) {
  const lines = new Array<string>(rows.length);
  for (let i = 0; i < rows.length; i += 1) {
    lines[i] = JSON.stringify(rows[i]);
  }
  const bytes = encoder.encode(`${lines.join("\n")}\n`);
  const size = bytes.byteLength;
  const { error } = await adminClient.storage.from("backups").upload(path, bytes, {
    contentType: "application/x-ndjson",
    upsert: false,
  });
  if (error) throw new Error(`Upload ${path}: ${error.message}`);
  lines.length = 0;
  rows.length = 0;
  return size;
}

async function listBucketEntries(
  adminClient: ReturnType<typeof createClient>,
  bucket: string,
) {
  const entries: Array<Record<string, unknown>> = [];
  const stack: string[] = [""];

  while (stack.length > 0) {
    const current = stack.pop() ?? "";
    const { data, error } = await adminClient.storage.from(bucket).list(current, {
      limit: STORAGE_LIST_LIMIT,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(`Storage ${bucket}/${current}: ${error.message}`);
    if (!data?.length) continue;

    for (const entry of data) {
      const path = current ? `${current}/${entry.name}` : entry.name;
      const isFolder = entry.id === null;
      if (isFolder) stack.push(path);
      entries.push({
        bucket,
        path,
        name: entry.name,
        is_folder: isFolder,
        created_at: entry.created_at ?? null,
        updated_at: entry.updated_at ?? null,
        last_accessed_at: entry.last_accessed_at ?? null,
        metadata: entry.metadata ?? null,
      });
    }

    await tick();
  }

  return entries;
}

async function runPostBackupTasks(params: {
  supabaseUrl: string;
  serviceRoleKey: string;
  backupId: string;
  folderPath: string;
  notify: boolean;
  notifyEmail: string | null;
  downloadUrl: string | null;
  sizeBytes: number;
  storageFileCount: number;
  source: string;
  startedAt: string;
}) {
  const {
    supabaseUrl,
    serviceRoleKey,
    backupId,
    folderPath,
    notify,
    notifyEmail,
    downloadUrl,
    sizeBytes,
    storageFileCount,
    source,
    startedAt,
  } = params;

  try {
    const syncRes = await fetch(`${supabaseUrl}/functions/v1/sync-backup-to-hetzner`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ folder_path: folderPath, backup_id: backupId }),
    });
    if (!syncRes.ok) {
      console.error("Hetzner sync failed:", await syncRes.text());
    } else {
      await syncRes.text();
    }
  } catch (error) {
    console.error("Hetzner sync exception:", error);
  }

  if (notify && notifyEmail && downloadUrl) {
    try {
      const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          templateName: "backup-ready",
          recipientEmail: notifyEmail,
          idempotencyKey: `backup-${backupId}`,
          templateData: {
            backup_id: backupId,
            download_url: downloadUrl,
            expires_in_hours: 168,
            size_mb: (sizeBytes / 1024 / 1024).toFixed(2),
            table_count: BACKUP_TABLES.length,
            storage_file_count: storageFileCount,
            source,
            created_at: startedAt,
          },
        }),
      });
      if (!emailRes.ok) {
        console.error("Email send failed:", await emailRes.text());
      } else {
        await emailRes.text();
      }
    } catch (error) {
      console.error("Email send exception:", error);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const cronSecret = Deno.env.get("CRON_SECRET");
  const authHeader = req.headers.get("Authorization") ?? "";
  const isCronCall = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);

  let callerUserId: string | null = null;
  let notifyEmail: string | null = null;
  let source = "manual";
  let notify = false;
  let scope: "full" | "db_only" = "full";

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    source = body.source === "cron" ? "cron" : "manual";
    notify = body.notify === true;
    if (body.scope === "db_only") scope = "db_only";
    if (typeof body.notify_email === "string" && body.notify_email.trim()) {
      notifyEmail = body.notify_email.trim();
    }
  } catch {
    // ignore invalid body
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  if (!isCronCall) {
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const { data: userData, error: userErr } = await adminClient.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: "Invalid session" }, 401);
    callerUserId = userData.user.id;

    const { data: roleRows } = await adminClient
      .from("user_roles")
      .select("roles!inner(name)")
      .eq("user_id", callerUserId);
    const roleNames = (roleRows ?? []).map((row: any) => row.roles?.name).filter(Boolean);
    if (!roleNames.includes("Admin") && !roleNames.includes("Super Admin")) {
      return json({ error: "Forbidden – Admin role required" }, 403);
    }

    if (notify && !notifyEmail) {
      const { data: profile } = await adminClient
        .from("user_profiles")
        .select("email")
        .eq("id", callerUserId)
        .maybeSingle();
      notifyEmail = profile?.email ?? null;
    }
  }

  const backupId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const dateStr = startedAt.replace(/[:.]/g, "-");
  const folderPath = `${dateStr.slice(0, 10)}/backup-${dateStr}-${backupId.slice(0, 8)}`;
  const manifestPath = `${folderPath}/manifest.json`;

  const { error: insErr } = await adminClient.from("backups_metadata").insert({
    id: backupId,
    backup_type: source === "cron" ? "automated" : "manual",
    backup_scope: scope,
    backup_status: "running",
    started_at: startedAt,
    storage_location: "supabase_storage:backups",
    storage_path: manifestPath,
    notify_email: notifyEmail,
    created_by: callerUserId,
    message: source === "cron"
      ? "Automatisches wöchentliches Backup gestartet"
      : "Manuelles Backup gestartet",
  });
  if (insErr) {
    console.error("backups_metadata insert failed:", insErr);
    return json({ success: false, error: `Metadata-Insert: ${insErr.message}` }, 500);
  }

  try {
    const counts: Record<string, number> = {};
    const files: Array<{ table: string; path: string; rows: number; size_bytes: number }> = [];
    const storageIndexFiles: string[] = [];
    let totalSize = 0;
    let storageFileCount = 0;

    for (const table of BACKUP_TABLES) {
      console.log(`Backing up table: ${table}`);
      const tableDir = `${folderPath}/tables/${table}`;
      let rowCount = 0;
      let partIndex = 0;
      let from = 0;

      while (true) {
        const { data, error } = await adminClient
          .from(table)
          .select("*")
          .range(from, from + DB_PAGE_SIZE - 1);
        if (error) throw new Error(`Tabelle ${table}: ${error.message}`);
        if (!data?.length) break;

        const pageRows = data.length;
        const partName = `part-${String(partIndex).padStart(5, "0")}.ndjson`;
        const partPath = `${tableDir}/${partName}`;
        const size = await uploadNdjsonPart(adminClient, partPath, data as Record<string, unknown>[]);

        files.push({ table, path: partPath, rows: pageRows, size_bytes: size });
        rowCount += pageRows;
        totalSize += size;
        partIndex += 1;

        await tick();

        if (pageRows < DB_PAGE_SIZE) break;
        from += DB_PAGE_SIZE;
      }

      counts[table] = rowCount;
    }

    if (scope === "full") {
      for (const bucket of STORAGE_BUCKETS) {
        console.log(`Indexing storage bucket: ${bucket}`);
        const entries = await listBucketEntries(adminClient, bucket);
        storageFileCount += entries.length;
        const inventoryPath = `${folderPath}/storage/${bucket}.json`;
        await uploadJson(adminClient, inventoryPath, entries);
        storageIndexFiles.push(inventoryPath);
        entries.length = 0;
        await tick();
      }
    }

    const manifest = {
      meta: {
        backup_id: backupId,
        created_at: startedAt,
        source,
        scope,
        project_ref: "xmrmkgfgpoundfwhnxfs",
        version: 3,
      },
      counts,
      files,
      storage_index_files: storageIndexFiles,
      storage_file_count: storageFileCount,
      total_db_size_bytes: totalSize,
    };

    const manifestSize = await uploadJson(adminClient, manifestPath, manifest);
    const expiresIn = 60 * 60 * 24 * 7;
    const { data: signed } = await adminClient.storage.from("backups").createSignedUrl(manifestPath, expiresIn);
    const sizeBytes = totalSize + manifestSize;
    const completedAt = new Date().toISOString();

    await adminClient
      .from("backups_metadata")
      .update({
        backup_status: "success",
        completed_at: completedAt,
        backup_size_bytes: sizeBytes,
        file_count: storageFileCount,
        integrity_status: "valid",
        message: `Backup erfolgreich. ${BACKUP_TABLES.length} Tabellen (NDJSON), ${storageFileCount} Storage-Dateien indexiert.`,
      })
      .eq("id", backupId);

    const postBackupPromise = runPostBackupTasks({
      supabaseUrl,
      serviceRoleKey,
      backupId,
      folderPath,
      notify,
      notifyEmail,
      downloadUrl: signed?.signedUrl ?? null,
      sizeBytes,
      storageFileCount,
      source,
      startedAt,
    });

    if (typeof EdgeRuntime !== "undefined" && typeof EdgeRuntime.waitUntil === "function") {
      EdgeRuntime.waitUntil(postBackupPromise);
    } else {
      postBackupPromise.catch((error) => console.error("Post-backup task failed:", error));
    }

    return json({
      success: true,
      backup_id: backupId,
      storage_path: manifestPath,
      folder_path: folderPath,
      size_bytes: sizeBytes,
      counts,
      storage_file_count: storageFileCount,
      download_url: signed?.signedUrl ?? null,
      expires_in_seconds: expiresIn,
      email_sent: false,
      notify_email: notifyEmail,
      hetzner_sync: { queued: true },
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Backup failed:", errorMsg);

    await adminClient
      .from("backups_metadata")
      .update({
        backup_status: "failed",
        completed_at: new Date().toISOString(),
        integrity_status: "invalid",
        message: `Backup fehlgeschlagen: ${errorMsg}`,
      })
      .eq("id", backupId);

    try {
      await adminClient.functions.invoke("send-transactional-email", {
        body: {
          templateName: "backup-failure-alert",
          recipientEmail: "rde@alix-lasers.com",
          idempotencyKey: `backup-fail-${backupId}`,
          templateData: {
            backup_id: backupId,
            backup_type: source === "cron" ? "automated" : "manual",
            backup_scope: scope,
            failure_kind: "Backup fehlgeschlagen",
            backup_status: "failed",
            integrity_status: "invalid",
            error_message: errorMsg,
            occurred_at: new Date().toISOString(),
            source: source === "cron" ? "cron (create-full-backup)" : "manual (create-full-backup)",
          },
        },
      });
    } catch (alertErr) {
      console.error("Failed to send backup failure alert:", alertErr);
    }

    return json({ success: false, error: errorMsg }, 500);
  }
});
