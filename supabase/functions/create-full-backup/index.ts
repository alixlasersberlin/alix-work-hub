import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

type BackupAdminClient = any;

type BackupFileEntry = {
  table: string;
  path: string;
  rows: number;
  size_bytes: number;
};

type BackupState = {
  phase: "tables" | "storage" | "finalizing";
  tableIndex: number;
  rowOffset: number;
  partIndex: number;
  bucketIndex: number;
  counts: Record<string, number>;
  files: BackupFileEntry[];
  storageIndexFiles: string[];
  totalSize: number;
  storageFileCount: number;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

const STORAGE_BUCKETS = [
  "production-orders",
  "production-photos",
  "order-invoices",
];
const DB_PAGE_SIZE = 200;
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
  adminClient: BackupAdminClient,
  path: string,
  payload: unknown,
  upsert = false,
) {
  const bytes = encoder.encode(JSON.stringify(payload));
  const size = bytes.byteLength;
  const { error } = await adminClient.storage
    .from("backups")
    .upload(path, bytes, {
      contentType: "application/json",
      upsert,
    });
  if (error) throw new Error(`Upload ${path}: ${error.message}`);
  return size;
}

async function readJson<T>(adminClient: BackupAdminClient, path: string): Promise<T> {
  const { data, error } = await adminClient.storage.from("backups").download(path);
  if (error || !data) throw new Error(`Read ${path}: ${error?.message ?? "missing file"}`);
  return JSON.parse(await data.text()) as T;
}

async function uploadNdjsonPart(
  adminClient: BackupAdminClient,
  path: string,
  rows: Record<string, unknown>[],
) {
  const lines = new Array<string>(rows.length);
  for (let i = 0; i < rows.length; i += 1) {
    lines[i] = JSON.stringify(rows[i]);
  }
  const bytes = encoder.encode(`${lines.join("\n")}\n`);
  const size = bytes.byteLength;
  const { error } = await adminClient.storage
    .from("backups")
    .upload(path, bytes, {
      contentType: "application/x-ndjson",
      upsert: false,
    });
  if (error) throw new Error(`Upload ${path}: ${error.message}`);
  return size;
}

async function listBucketEntries(
  adminClient: BackupAdminClient,
  bucket: string,
) {
  const entries: Array<Record<string, unknown>> = [];
  const stack: string[] = [""];

  while (stack.length > 0) {
    const current = stack.pop() ?? "";
    const { data, error } = await adminClient.storage
      .from(bucket)
      .list(current, {
        limit: STORAGE_LIST_LIMIT,
        sortBy: { column: "name", order: "asc" },
      });
    if (error) {
      throw new Error(`Storage ${bucket}/${current}: ${error.message}`);
    }
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

async function updateBackupMessage(
  adminClient: BackupAdminClient,
  backupId: string,
  message: string,
) {
  const { error } = await adminClient
    .from("backups_metadata")
    .update({ message })
    .eq("id", backupId);
  if (error) {
    console.error("Failed to update backup message:", error.message);
  }
}

async function queueNextStep(params: {
  supabaseUrl: string;
  serviceRoleKey: string;
  backupId: string;
  folderPath: string;
  manifestPath: string;
  notify: boolean;
  notifyEmail: string | null;
  source: string;
  scope: "full" | "db_only";
  startedAt: string;
}) {
  const res = await fetch(`${params.supabaseUrl}/functions/v1/create-full-backup`, {
    method: "POST",
    keepalive: true,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.serviceRoleKey}`,
    },
    body: JSON.stringify({
      internal: true,
      backup_id: params.backupId,
      folder_path: params.folderPath,
      manifest_path: params.manifestPath,
      notify: params.notify,
      notify_email: params.notifyEmail,
      source: params.source,
      scope: params.scope,
      started_at: params.startedAt,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Nächster Backup-Schritt konnte nicht gestartet werden: HTTP ${res.status} ${text}`);
  }

  await res.text();
}

function triggerNextStep(
  adminClient: BackupAdminClient,
  params: {
    supabaseUrl: string;
    serviceRoleKey: string;
    backupId: string;
    folderPath: string;
    manifestPath: string;
    notify: boolean;
    notifyEmail: string | null;
    source: string;
    scope: "full" | "db_only";
    startedAt: string;
  },
) {
  queueNextStep(params).catch(async (error) => {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Failed to queue next backup step:", errorMsg);
    await failBackup({
      adminClient,
      backupId: params.backupId,
      source: params.source,
      scope: params.scope,
      errorMsg,
    });
  });
}

async function sendFailureAlert(params: {
  adminClient: BackupAdminClient;
  backupId: string;
  source: string;
  scope: "full" | "db_only";
  errorMsg: string;
}) {
  try {
    await params.adminClient.functions.invoke("send-transactional-email", {
      body: {
        templateName: "backup-failure-alert",
        recipientEmail: "rde@alix-lasers.com",
        idempotencyKey: `backup-fail-${params.backupId}`,
        templateData: {
          backup_id: params.backupId,
          backup_type: params.source === "cron" ? "automated" : "manual",
          backup_scope: params.scope,
          failure_kind: "Backup fehlgeschlagen",
          backup_status: "failed",
          integrity_status: "invalid",
          error_message: params.errorMsg,
          occurred_at: new Date().toISOString(),
          source:
            params.source === "cron"
              ? "cron (create-full-backup)"
              : "manual (create-full-backup)",
        },
      },
    });
  } catch (alertErr) {
    console.error("Failed to send backup failure alert:", alertErr);
  }
}

async function failBackup(params: {
  adminClient: BackupAdminClient;
  backupId: string;
  source: string;
  scope: "full" | "db_only";
  errorMsg: string;
}) {
  await params.adminClient
    .from("backups_metadata")
    .update({
      backup_status: "failed",
      completed_at: new Date().toISOString(),
      integrity_status: "invalid",
      message: `Backup fehlgeschlagen: ${params.errorMsg}`,
    })
    .eq("id", params.backupId);

  await sendFailureAlert(params);
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
    const syncRes = await fetch(
      `${supabaseUrl}/functions/v1/sync-backup-to-hetzner`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ folder_path: folderPath, backup_id: backupId }),
      },
    );
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
      const emailRes = await fetch(
        `${supabaseUrl}/functions/v1/send-transactional-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
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
        },
      );
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

async function processBackupStep(params: {
  adminClient: BackupAdminClient;
  supabaseUrl: string;
  serviceRoleKey: string;
  backupId: string;
  folderPath: string;
  manifestPath: string;
  notify: boolean;
  notifyEmail: string | null;
  source: string;
  scope: "full" | "db_only";
  startedAt: string;
}) {
  const {
    adminClient,
    supabaseUrl,
    serviceRoleKey,
    backupId,
    folderPath,
    manifestPath,
    notify,
    notifyEmail,
    source,
    scope,
    startedAt,
  } = params;

  const statePath = `${folderPath}/state.json`;

  try {
    const state = await readJson<BackupState>(adminClient, statePath);

    if (state.phase === "tables") {
      if (state.tableIndex >= BACKUP_TABLES.length) {
        state.phase = scope === "full" ? "storage" : "finalizing";
        await uploadJson(adminClient, statePath, state, true);
        triggerNextStep(adminClient, params);
        return { success: true, accepted: true, backup_id: backupId, backup_status: "running" };
      }

      const table = BACKUP_TABLES[state.tableIndex];
      await updateBackupMessage(
        adminClient,
        backupId,
        `Backup läuft: Tabelle ${table} ab Datensatz ${state.rowOffset + 1}`,
      );

      const { data, error } = await adminClient
        .from(table)
        .select("*")
        .range(state.rowOffset, state.rowOffset + DB_PAGE_SIZE - 1);
      if (error) throw new Error(`Tabelle ${table}: ${error.message}`);

      const pageRows = data?.length ?? 0;
      if (pageRows === 0) {
        state.counts[table] = state.counts[table] ?? 0;
        state.tableIndex += 1;
        state.rowOffset = 0;
        state.partIndex = 0;
      } else {
        const partName = `part-${String(state.partIndex).padStart(5, "0")}.ndjson`;
        const partPath = `${folderPath}/tables/${table}/${partName}`;
        const size = await uploadNdjsonPart(
          adminClient,
          partPath,
          data as Record<string, unknown>[],
        );

        state.files.push({ table, path: partPath, rows: pageRows, size_bytes: size });
        state.counts[table] = (state.counts[table] ?? 0) + pageRows;
        state.totalSize += size;
        state.partIndex += 1;

        if (pageRows < DB_PAGE_SIZE) {
          state.tableIndex += 1;
          state.rowOffset = 0;
          state.partIndex = 0;
        } else {
          state.rowOffset += pageRows;
        }
      }

      await uploadJson(adminClient, statePath, state, true);
      await tick();
      triggerNextStep(adminClient, params);
      return { success: true, accepted: true, backup_id: backupId, backup_status: "running" };
    }

    if (state.phase === "storage") {
      if (state.bucketIndex >= STORAGE_BUCKETS.length) {
        state.phase = "finalizing";
        await uploadJson(adminClient, statePath, state, true);
        triggerNextStep(adminClient, params);
        return { success: true, accepted: true, backup_id: backupId, backup_status: "running" };
      }

      const bucket = STORAGE_BUCKETS[state.bucketIndex];
      await updateBackupMessage(
        adminClient,
        backupId,
        `Backup läuft: Storage-Inventar ${bucket}`,
      );

      const entries = await listBucketEntries(adminClient, bucket);
      const inventoryPath = `${folderPath}/storage/${bucket}.json`;
      await uploadJson(adminClient, inventoryPath, entries);
      state.storageFileCount += entries.length;
      state.storageIndexFiles.push(inventoryPath);
      state.bucketIndex += 1;

      await uploadJson(adminClient, statePath, state, true);
      await tick();
      triggerNextStep(adminClient, params);
      return { success: true, accepted: true, backup_id: backupId, backup_status: "running" };
    }

    await updateBackupMessage(adminClient, backupId, "Backup wird finalisiert");
    const manifest = {
      meta: {
        backup_id: backupId,
        created_at: startedAt,
        source,
        scope,
        project_ref: "xmrmkgfgpoundfwhnxfs",
        version: 4,
      },
      counts: state.counts,
      files: state.files,
      storage_index_files: state.storageIndexFiles,
      storage_file_count: state.storageFileCount,
      total_db_size_bytes: state.totalSize,
    };

    const manifestSize = await uploadJson(adminClient, manifestPath, manifest);
    const expiresIn = 60 * 60 * 24 * 7;
    const { data: signed } = await adminClient.storage
      .from("backups")
      .createSignedUrl(manifestPath, expiresIn);
    const sizeBytes = state.totalSize + manifestSize;
    const completedAt = new Date().toISOString();

    await adminClient
      .from("backups_metadata")
      .update({
        backup_status: "success",
        completed_at: completedAt,
        backup_size_bytes: sizeBytes,
        file_count: state.storageFileCount,
        integrity_status: "valid",
        message: `Backup erfolgreich. ${BACKUP_TABLES.length} Tabellen (NDJSON), ${state.storageFileCount} Storage-Dateien indexiert.`,
      })
      .eq("id", backupId);

    runPostBackupTasks({
      supabaseUrl,
      serviceRoleKey,
      backupId,
      folderPath,
      notify,
      notifyEmail,
      downloadUrl: signed?.signedUrl ?? null,
      sizeBytes,
      storageFileCount: state.storageFileCount,
      source,
      startedAt,
    }).catch((error) => console.error("Post-backup task failed:", error));

    return {
      success: true,
      backup_id: backupId,
      storage_path: manifestPath,
      folder_path: folderPath,
      size_bytes: sizeBytes,
      counts: state.counts,
      storage_file_count: state.storageFileCount,
      download_url: signed?.signedUrl ?? null,
      expires_in_seconds: expiresIn,
      email_sent: false,
      notify_email: notifyEmail,
      hetzner_sync: { queued: true },
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Backup failed:", errorMsg);
    await failBackup({ adminClient, backupId, source, scope, errorMsg });
    throw err;
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
  const isServiceCall = authHeader === `Bearer ${serviceRoleKey}`;

  let body: any = {};
  try {
    body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  } catch {
    body = {};
  }

  const isInternal = body.internal === true;
  let callerUserId: string | null = null;
  let notifyEmail: string | null = null;
  let source = body.source === "cron" ? "cron" : "manual";
  let notify = body.notify === true;
  let scope: "full" | "db_only" = body.scope === "db_only" ? "db_only" : "full";

  if (typeof body.notify_email === "string" && body.notify_email.trim()) {
    notifyEmail = body.notify_email.trim();
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  if (isInternal) {
    if (!isServiceCall) {
      return json({ error: "Forbidden" }, 403);
    }

    try {
      const result = await processBackupStep({
        adminClient,
        supabaseUrl,
        serviceRoleKey,
        backupId: String(body.backup_id ?? ""),
        folderPath: String(body.folder_path ?? ""),
        manifestPath: String(body.manifest_path ?? ""),
        notify,
        notifyEmail,
        source,
        scope,
        startedAt: String(body.started_at ?? new Date().toISOString()),
      });
      return json(result, result.success && result.accepted ? 202 : 200);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return json({ success: false, error: errorMsg }, 500);
    }
  }

  if (!isCronCall) {
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const { data: userData, error: userErr } = await adminClient.auth.getUser(token);
    if (userErr || !userData.user) {
      return json({ error: "Invalid session" }, 401);
    }
    callerUserId = userData.user.id;

    const { data: roleRows } = await adminClient
      .from("user_roles")
      .select("roles!inner(name)")
      .eq("user_id", callerUserId);
    const roleNames = (roleRows ?? [])
      .map((row: any) => row.roles?.name)
      .filter(Boolean);
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
  const statePath = `${folderPath}/state.json`;

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
    message:
      source === "cron"
        ? "Automatisches wöchentliches Backup gestartet"
        : "Manuelles Backup gestartet",
  });
  if (insErr) {
    console.error("backups_metadata insert failed:", insErr);
    return json({ success: false, error: `Metadata-Insert: ${insErr.message}` }, 500);
  }

  try {
    const initialState: BackupState = {
      phase: "tables",
      tableIndex: 0,
      rowOffset: 0,
      partIndex: 0,
      bucketIndex: 0,
      counts: {},
      files: [],
      storageIndexFiles: [],
      totalSize: 0,
      storageFileCount: 0,
    };

    await uploadJson(adminClient, statePath, initialState, false);
    triggerNextStep(adminClient, {
      supabaseUrl,
      serviceRoleKey,
      backupId,
      folderPath,
      manifestPath,
      notify,
      notifyEmail,
      source,
      scope,
      startedAt,
    });

    return json({
      success: true,
      accepted: true,
      backup_id: backupId,
      storage_path: manifestPath,
      folder_path: folderPath,
      backup_status: "running",
      notify_email: notifyEmail,
      message: "Backup gestartet. Verarbeitung läuft im Hintergrund.",
    }, 202);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await failBackup({ adminClient, backupId, source, scope, errorMsg });
    return json({ success: false, error: errorMsg }, 500);
  }
});
