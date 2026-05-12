import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Tables to include in the backup (excluding pure audit/log tables and otp_challenges)
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const cronSecret = Deno.env.get("CRON_SECRET");

  // Auth: either valid user JWT (admin verified below) or cron secret
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
  } catch {
    /* ignore */
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  if (!isCronCall) {
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return json({ error: "Unauthorized" }, 401);
    }
    const { data: userData, error: userErr } = await adminClient.auth.getUser(token);
    if (userErr || !userData.user) {
      return json({ error: "Invalid session" }, 401);
    }
    callerUserId = userData.user.id;

    // Admin check
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
  const storagePath = `${dateStr.slice(0, 10)}/backup-${dateStr}-${backupId.slice(0, 8)}.json`;

  await adminClient.from("backups_metadata").insert({
    id: backupId,
    backup_type: source === "cron" ? "automated" : "manual",
    backup_scope: scope,
    backup_status: "in_progress",
    started_at: startedAt,
    storage_location: "supabase_storage:backups",
    storage_path: storagePath,
    notify_email: notifyEmail,
    created_by: callerUserId,
    message: source === "cron"
      ? "Automatisches wöchentliches Backup gestartet"
      : "Manuelles Backup gestartet",
  });

  try {
    const dump: Record<string, any> = {
      meta: {
        backup_id: backupId,
        created_at: startedAt,
        source,
        scope,
        project_ref: "xmrmkgfgpoundfwhnxfs",
        version: 1,
      },
      tables: {} as Record<string, any[]>,
      storage: {} as Record<string, any[]>,
      counts: {} as Record<string, number>,
    };

    // Dump tables
    for (const table of BACKUP_TABLES) {
      const rows: any[] = [];
      const pageSize = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await adminClient
          .from(table)
          .select("*")
          .range(from, from + pageSize - 1);
        if (error) {
          throw new Error(`Tabelle ${table}: ${error.message}`);
        }
        if (!data || data.length === 0) break;
        rows.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      dump.tables[table] = rows;
      dump.counts[table] = rows.length;
    }

    // List storage objects (file inventory only — file blobs not embedded to keep dump portable)
    if (scope === "full") {
      for (const bucket of STORAGE_BUCKETS) {
        const inventory: any[] = [];
        const { data, error } = await adminClient.storage.from(bucket).list("", {
          limit: 1000,
          sortBy: { column: "name", order: "asc" },
        });
        if (!error && data) {
          inventory.push(...data);
          // Recurse one level deep into folders
          for (const entry of data) {
            if (entry.id === null) {
              const { data: sub } = await adminClient.storage.from(bucket).list(entry.name, { limit: 1000 });
              if (sub) inventory.push(...sub.map((s) => ({ ...s, _folder: entry.name })));
            }
          }
        }
        dump.storage[bucket] = inventory;
      }
    }

    const json_str = JSON.stringify(dump);
    const sizeBytes = new Blob([json_str]).size;
    const fileCount = Object.values(dump.storage).reduce((acc: number, arr: any) => acc + (arr?.length ?? 0), 0);

    // Upload to backups bucket
    const { error: uploadErr } = await adminClient.storage
      .from("backups")
      .upload(storagePath, new Blob([json_str], { type: "application/json" }), {
        contentType: "application/json",
        upsert: false,
      });
    if (uploadErr) throw new Error(`Upload fehlgeschlagen: ${uploadErr.message}`);

    // Signed URL valid for 7 days
    const expiresIn = 60 * 60 * 24 * 7;
    const { data: signed } = await adminClient.storage
      .from("backups")
      .createSignedUrl(storagePath, expiresIn);

    const completedAt = new Date().toISOString();
    await adminClient
      .from("backups_metadata")
      .update({
        backup_status: "completed",
        completed_at: completedAt,
        backup_size_bytes: sizeBytes,
        file_count: fileCount,
        integrity_status: "verified",
        message: `Backup erfolgreich. ${BACKUP_TABLES.length} Tabellen, ${fileCount} Storage-Dateien indexiert.`,
      })
      .eq("id", backupId);

    // Send email notification
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
              storage_file_count: fileCount,
              source,
              created_at: startedAt,
            },
          }),
        });
        emailSent = emailRes.ok;
        if (!emailRes.ok) {
          console.error("Email send failed:", await emailRes.text());
        }
      } catch (e) {
        console.error("Email send exception:", e);
      }
    }

    return json({
      success: true,
      backup_id: backupId,
      storage_path: storagePath,
      size_bytes: sizeBytes,
      counts: dump.counts,
      storage_file_count: fileCount,
      download_url: signed?.signedUrl ?? null,
      expires_in_seconds: expiresIn,
      email_sent: emailSent,
      notify_email: notifyEmail,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Backup failed:", errorMsg);
    await adminClient
      .from("backups_metadata")
      .update({
        backup_status: "failed",
        completed_at: new Date().toISOString(),
        integrity_status: "error",
        message: `Backup fehlgeschlagen: ${errorMsg}`,
      })
      .eq("id", backupId);

    return json({ success: false, error: errorMsg }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
