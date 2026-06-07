import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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

const STORAGE_BUCKETS = ["production-orders", "production-photos", "order-invoices"];
const PAGE_SIZE = 200;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const cronSecret = Deno.env.get("CRON_SECRET");

  const authHeader = req.headers.get("Authorization") ?? "";
  const isCronCall = cronSecret && authHeader === `Bearer ${cronSecret}`;
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
    if (body.notify_email && typeof body.notify_email === "string") {
      notifyEmail = body.notify_email;
    }
  } catch { /* ignore */ }

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
    const roleNames = (roleRows ?? []).map((r: any) => r.roles?.name).filter(Boolean);
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
    let totalSize = 0;

    // Stream each table page-by-page. Each page is uploaded as its own
    // ndjson part file to avoid holding the full table in memory (OOM).
    for (const table of BACKUP_TABLES) {
      const tableDir = `${folderPath}/tables/${table}`;
      let rowCount = 0;
      let tableSize = 0;
      let partIndex = 0;
      let from = 0;

      while (true) {
        const { data, error } = await adminClient
          .from(table)
          .select("*")
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw new Error(`Tabelle ${table}: ${error.message}`);
        if (!data || data.length === 0) break;

        let ndjson = "";
        for (const row of data) ndjson += JSON.stringify(row) + "\n";
        const pageRows = data.length;
        // free reference before upload
        (data as any).length = 0;

        const partName = `part-${String(partIndex).padStart(5, "0")}.ndjson`;
        const partPath = `${tableDir}/${partName}`;
        const blob = new Blob([ndjson], { type: "application/x-ndjson" });
        const size = blob.size;
        ndjson = "";

        const { error: upErr } = await adminClient.storage
          .from("backups")
          .upload(partPath, blob, { contentType: "application/x-ndjson", upsert: false });
        if (upErr) throw new Error(`Upload ${table} ${partName}: ${upErr.message}`);

        files.push({ table, path: partPath, rows: pageRows, size_bytes: size });
        rowCount += pageRows;
        tableSize += size;
        totalSize += size;
        partIndex += 1;

        if (pageRows < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      counts[table] = rowCount;
    }

    // Storage inventory (lightweight)
    const storageInventory: Record<string, any[]> = {};
    let storageFileCount = 0;
    if (scope === "full") {
      for (const bucket of STORAGE_BUCKETS) {
        const inv: any[] = [];
        const { data } = await adminClient.storage.from(bucket).list("", {
          limit: 1000,
          sortBy: { column: "name", order: "asc" },
        });
        if (data) {
          inv.push(...data);
          for (const entry of data) {
            if (entry.id === null) {
              const { data: sub } = await adminClient.storage.from(bucket).list(entry.name, { limit: 1000 });
              if (sub) inv.push(...sub.map((s) => ({ ...s, _folder: entry.name })));
            }
          }
        }
        storageInventory[bucket] = inv;
        storageFileCount += inv.length;
      }
    }

    const manifest = {
      meta: {
        backup_id: backupId,
        created_at: startedAt,
        source,
        scope,
        project_ref: "xmrmkgfgpoundfwhnxfs",
        version: 2,
      },
      counts,
      files,
      storage: storageInventory,
      storage_file_count: storageFileCount,
      total_db_size_bytes: totalSize,
    };
    const manifestStr = JSON.stringify(manifest, null, 2);
    const manifestSize = new Blob([manifestStr]).size;

    const { error: mErr } = await adminClient.storage
      .from("backups")
      .upload(manifestPath, new Blob([manifestStr], { type: "application/json" }), {
        contentType: "application/json",
        upsert: false,
      });
    if (mErr) throw new Error(`Manifest-Upload: ${mErr.message}`);

    const expiresIn = 60 * 60 * 24 * 7;
    const { data: signed } = await adminClient.storage
      .from("backups")
      .createSignedUrl(manifestPath, expiresIn);

    const completedAt = new Date().toISOString();
    const sizeBytes = totalSize + manifestSize;
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

    // Replicate to Hetzner Object Storage (best-effort, non-blocking for response)
    let hetznerSync: any = null;
    try {
      const syncRes = await fetch(`${supabaseUrl}/functions/v1/sync-backup-to-hetzner`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ folder_path: folderPath, backup_id: backupId }),
      });
      hetznerSync = await syncRes.json().catch(() => ({ ok: syncRes.ok }));
    } catch (e) {
      console.error("Hetzner sync failed:", e);
      hetznerSync = { success: false, error: String(e) };
    }



    let emailSent = false;
    if (notify && notifyEmail && signed?.signedUrl) {
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
              download_url: signed.signedUrl,
              expires_in_hours: 168,
              size_mb: (sizeBytes / 1024 / 1024).toFixed(2),
              table_count: BACKUP_TABLES.length,
              storage_file_count: storageFileCount,
              source,
              created_at: startedAt,
            },
          }),
        });
        emailSent = emailRes.ok;
        if (!emailRes.ok) console.error("Email send failed:", await emailRes.text());
      } catch (e) {
        console.error("Email send exception:", e);
      }
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
      email_sent: emailSent,
      notify_email: notifyEmail,
      hetzner_sync: hetznerSync,
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

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
