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
  "academy_bookings","academy_sessions","ai_service_analyses","ai_service_logs",
  "aic_analysis_runs","aic_forecasts","aic_insights","aic_report_schedules","aic_reports","aic_tasks",
  "alix_sign_audit_log","alix_sign_requests","alix_sign_signatures",
  "alixsmart_migration_logs","alixsmart_migration_map","alixsmart_products",
  "api_rate_limits","app_settings","audit_findings","audit_logs",
  "backup_notifications","backup_schedules","backup_settings","backups_metadata",
  "bank_financing_requests","bugs","capa_actions","capas",
  "copilot_audit_log","copilot_departments","copilot_import_jobs","copilot_knowledge_entries",
  "copilot_module_access","copilot_settings","copilot_source_files","copilot_sources",
  "customer_communication_log","customer_notes",
  "customer_portal_document_downloads","customer_portal_quote_responses",
  "customer_portal_ticket_messages","customer_portal_tickets","customer_portal_users",
  "customer_sms_logs","customers","deleted_customers","departments",
  "device_health_scores","device_lifecycle","device_maintenance",
  "dispatch_attachments","dispatch_checklist_runs","dispatch_checklists",
  "dispatch_signatures","dispatch_used_parts","dispatch_vehicles",
  "email_send_log","email_templates","email_unsubscribe_tokens",
  "finance_accounts","finance_ai_insights","finance_anomalies","finance_approvals",
  "finance_asset_depreciations","finance_assets","finance_automation_runs","finance_automations",
  "finance_bank_accounts","finance_bank_lines","finance_bank_statements","finance_budgets",
  "finance_cashflow_items","finance_cashflow_plans","finance_consolidation_items","finance_consolidation_runs",
  "finance_contracts","finance_documents","finance_forecasts","finance_fx_rates",
  "finance_goods_receipts","finance_history","finance_incoming_invoices",
  "finance_intercompany_matches","finance_intercompany_relations","finance_liquidity_entries",
  "finance_management_packs","finance_payment_approvals",
  "finance_purchase_order_items","finance_purchase_orders",
  "finance_purchase_requisition_items","finance_purchase_requisitions",
  "finance_records","finance_reminder_items","finance_reminders",
  "finance_report_schedules","finance_reports","finance_sepa_mandates",
  "finance_sepa_run_items","finance_sepa_runs","finance_stakeholder_access_logs",
  "finance_stakeholders","finance_tax_filing_lines","finance_tax_filings",
  "finance_three_way_matches","finance_transactions","finance_year_end_runs",
  "goods_receipts","goodwill_cases","integration_logs","invoice_workflow_states",
  "iso_audit_findings_ext","iso_audits","iso_change_controls",
  "iso_supplier_evaluations","iso_training_records","iso_trainings",
  "item_category_assignments","lager_devices","loaner_device_assignments","login_sessions",
  "mail_attachments","mail_audit_logs","mail_automation_runs","mail_automations",
  "mail_campaigns","mail_domains","mail_events","mail_followups","mail_internal_messages",
  "mail_messages","mail_notes","mail_notifications","mail_phone_notes",
  "mail_recipients","mail_tasks","mail_templates","mail_unsubscribes",
  "maintenance_confirmations","maintenance_plans","maintenance_reminder_log",
  "mdr_vigilance_reports","migration_backup_logs","mobile_push_subscriptions",
  "model_manuals","number_ranges","offers",
  "order_additional_deposits","order_at_approval","order_at_purchase",
  "order_documents","order_import_logs","order_items","order_notes","order_status_history","orders",
  "otp_challenges","product_categories","production_order_items","production_orders",
  "qm_attachments","qm_comments",
  "repair_attachments","repair_communications","repair_delivery_handover","repair_finance_handover",
  "repair_invoice_proposals","repair_orders","repair_parts","repair_quote_history",
  "repair_quote_items","repair_quotes","repair_signatures","repair_spare_parts",
  "repair_status_history","repair_work_orders","repair_workshop_intake",
  "restore_jobs","review_email_logs","reviews","roles","route_plans",
  "sales_followups","sales_lead_history","sales_leads",
  "service_ai_analyses","service_ai_feedback","service_ai_repair_guides",
  "service_communication_log","service_knowledge_base",
  "sms_settings","sms_templates",
  "spare_part_consumption","spare_part_order_items","spare_part_orders",
  "suppliers","support_videos","suppressed_emails","system_maintenance",
  "technician_skills","technician_stock","technician_stock_movements",
  "tenants","ticket_attachments","ticket_category_rules","ticket_messages",
  "ticket_outbound_sync_logs","ticket_sync_alerts","ticket_sync_logs","tickets",
  "user_invitations","user_profiles","user_roles","user_tenant_access",
  "warranty_claims","warranty_cost_items","warranty_decisions","warranty_records",
  "whatsapp_automations","whatsapp_consents","whatsapp_messages",
  "whatsapp_sc_conversations","whatsapp_sc_messages","whatsapp_sc_templates",
  "whatsapp_sync_logs","whatsapp_templates",
  "zoho_invoices","zoho_items","zoho_recurring_invoices","zoho_recurring_profiles","zoho_unpaid_invoices",
];

// All Storage Buckets (außer `backups` – das ist das Ziel selbst).
// Wir indexieren hier UND spiegeln die echten Dateien danach via sync-backup-to-hetzner
// (mirror_buckets=true) direkt nach Hetzner S3 unter dem Prefix `bucket-mirror/<bucket>/`.
const STORAGE_BUCKETS = [
  "alix-sign-pdfs",
  "bank-offers",
  "bug-capa-attachments",
  "finance-documents",
  "order-invoices",
  "production-orders",
  "production-photos",
  "repair-files",
];
const DB_PAGE_SIZE = 120;
// Tabellen mit großen JSON-Payloads (details/raw_data/attachments) → deutlich
// kleinere Seiten, sonst OOM (HTTP 546) im Edge-Worker beim Serialisieren.
const HEAVY_TABLES = new Set<string>([
  "audit_logs",
  "mail_audit_logs",
  "mail_events",
  "mail_messages",
  "mail_attachments",
  "mail_recipients",
  "ticket_messages",
  "ticket_attachments",
  "orders",
  "production_orders",
  "repair_orders",
  "sales_leads",
  "finance_documents",
  "finance_incoming_invoices",
  "finance_journal",
  "finance_history",
  "ai_service_analyses",
  "service_ai_analyses",
  "service_knowledge_base",
  "copilot_knowledge_entries",
  "alix_sign_signatures",
  "alix_sign_requests",
  "alix_sign_audit_log",
  "zoho_items",
  "zoho_invoices",
  "zoho_recurring_profiles",
  "zoho_recurring_invoices",
]);
// Extra-schwere Tabellen (sehr große jsonb-Payloads) bekommen die kleinste Seite.
const XL_TABLES = new Set<string>([
  "audit_logs",
  "mail_messages",
  "mail_attachments",
  "finance_documents",
  "ai_service_analyses",
  "service_ai_analyses",
]);
// Nano-Tabellen mit potenziell mehreren MB pro Row (z. B. Base64-Bilder in einer Zelle).
const NANO_TABLES = new Set<string>([
  "alix_sign_signatures",
]);
const HEAVY_PAGE_SIZE = 15;
const XL_PAGE_SIZE = 4;
const NANO_PAGE_SIZE = 2;
const pageSizeFor = (table: string) =>
  NANO_TABLES.has(table) ? NANO_PAGE_SIZE
    : XL_TABLES.has(table) ? XL_PAGE_SIZE
    : HEAVY_TABLES.has(table) ? HEAVY_PAGE_SIZE
    : DB_PAGE_SIZE;

// Konservativ pro Seite (Memory), aber viele Seiten pro Invocation (Speed).
const BATCH_MAX_MS = 40_000;
const BATCH_MAX_BYTES = 25 * 1024 * 1024; // 25 MB Uploads pro Worker

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
  let lastErr: string | null = null;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const { error } = await adminClient.storage
      .from("backups")
      .upload(path, bytes, {
        contentType: "application/json",
        upsert,
      });
    if (!error) return size;
    lastErr = error.message || String(error);
    const transient = /Service Unavailable|503|502|504|520|521|522|524|fetch failed|network|timeout|<!DOCTYPE|<html|Web server|Cloudflare|Unexpected token|not valid JSON/i.test(lastErr);
    if (!transient || attempt === 6) throw new Error(`Upload ${path}: ${lastErr}`);
    await new Promise((r) => setTimeout(r, Math.min(500 * 2 ** (attempt - 1), 8000)));
  }
  throw new Error(`Upload ${path}: ${lastErr ?? "unknown error"}`);
}

async function readJson<T>(adminClient: BackupAdminClient, path: string): Promise<T> {
  // Storage download kann nach einem upsert (eventually consistent) kurzzeitig
  // 404/leer liefern. Daher mit Backoff bis zu 5x retryen, bevor wir aufgeben.
  let lastErr: string | null = null;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const { data, error } = await adminClient.storage.from("backups").download(path);
    if (!error && data) {
      const text = await data.text();
      if (text && text.trim().length > 0) {
        try {
          return JSON.parse(text) as T;
        } catch (e) {
          lastErr = `invalid JSON: ${(e as Error).message}`;
        }
      } else {
        lastErr = "empty file";
      }
    } else {
      const raw = error ? (error.message || JSON.stringify(error)) : "missing file";
      lastErr = raw && raw !== "{}" ? raw : "transient storage read error";
    }
    await new Promise((r) => setTimeout(r, 400 * 2 ** (attempt - 1)));
  }
  throw new Error(`Read ${path}: ${lastErr ?? "unknown error"}`);
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
  let lastErr: string | null = null;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const { error } = await adminClient.storage
      .from("backups")
      .upload(path, bytes, {
        contentType: "application/x-ndjson",
        upsert: true,
      });
    if (!error) return size;
    lastErr = error.message || String(error);
    const transient = /Service Unavailable|503|502|504|520|521|522|524|fetch failed|network|timeout|<!DOCTYPE|<html|Web server|Cloudflare|Unexpected token|not valid JSON/i.test(lastErr);
    if (!transient || attempt === 6) throw new Error(`Upload ${path}: ${lastErr}`);
    await new Promise((r) => setTimeout(r, Math.min(500 * 2 ** (attempt - 1), 8000)));
  }
  throw new Error(`Upload ${path}: ${lastErr ?? "unknown error"}`);
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

function summarizeUpstreamError(status: number, text: string): string {
  const trimmed = (text || "").trim();
  // Strip HTML error pages — only keep a short hint
  if (trimmed.startsWith("<")) {
    return `Gateway-Fehler (HTTP ${status}, HTML-Antwort vom Edge-Runtime)`;
  }
  try {
    const obj = JSON.parse(trimmed);
    const msg = obj?.error || obj?.message || obj?.msg;
    if (msg) return `HTTP ${status}: ${String(msg).slice(0, 240)}`;
  } catch (_) { /* ignore */ }
  return `HTTP ${status} ${trimmed.slice(0, 240)}`;
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
  const body = JSON.stringify({
    internal: true,
    backup_id: params.backupId,
    folder_path: params.folderPath,
    manifest_path: params.manifestPath,
    notify: params.notify,
    notify_email: params.notifyEmail,
    source: params.source,
    scope: params.scope,
    started_at: params.startedAt,
  });

  // Retry on transient gateway/boot errors (HTML 5xx, 502/503/504, 546 compute,
  // network errors). Give the Edge Worker pool a moment to free CPU/memory
  // between the finished step and the next boot — Supabase returns HTTP 546
  // ("not enough compute resources") when we chain invocations too tightly.
  const maxAttempts = 8;
  // Kurzer Cooldown vor dem ersten Invoke — reicht meist, damit der vorherige
  // Worker seine Ressourcen freigibt. Bei 546 (compute exhausted) backen wir
  // weiter unten länger zurück.
  await new Promise((r) => setTimeout(r, 500));
  let lastErr = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const res = await fetch(`${params.supabaseUrl}/functions/v1/create-full-backup`, {
        method: "POST",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${params.serviceRoleKey}`,
        },
        body,
      });

      if (res.ok) {
        await res.text();
        return;
      }

      const text = await res.text();
      lastErr = summarizeUpstreamError(res.status, text);
      // HTTP 546 = compute-exhausted on next boot → always retriable, needs long backoff.
      const isCompute546 = res.status === 546;
      const retriable = res.status >= 500 || res.status === 429;
      console.error(`queueNextStep attempt ${attempt}/${maxAttempts} failed: ${lastErr}`);
      if (!retriable || attempt === maxAttempts) {
        throw new Error(`Nächster Backup-Schritt konnte nicht gestartet werden: ${lastErr}`);
      }
      // Für 546 (compute exhausted) etwas längerer Backoff, sonst kurz.
      const base = isCompute546 ? 3000 : 400;
      const delay = Math.min(base * 2 ** (attempt - 1), 30000);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lastErr = msg;
      console.error(`queueNextStep attempt ${attempt}/${maxAttempts} network error: ${msg}`);
      if (attempt === maxAttempts) {
        throw new Error(`Nächster Backup-Schritt konnte nicht gestartet werden: ${msg}`);
      }
      const delay = Math.min(1000 * 2 ** (attempt - 1), 30000);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
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
  const promise = queueNextStep(params).catch(async (error) => {
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
  // Keep the background fetch alive after the parent returns 202 — cron /
  // pg_net close the connection immediately and would otherwise cancel it.
  try {
    // @ts-ignore EdgeRuntime is provided by Supabase Edge Runtime
    EdgeRuntime.waitUntil(promise);
  } catch (_) {
    // no-op when EdgeRuntime is unavailable
  }
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
        body: JSON.stringify({
          folder_path: folderPath,
          backup_id: backupId,
          mirror_buckets: true,
        }),
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

      // Batch-Loop: mehrere Seiten pro Worker-Invocation verarbeiten, bis das
      // Zeit- oder Byte-Budget aufgebraucht ist. Spart den 500 ms – 3 s
      // Overhead zwischen Function-Invocations pro Seite.
      const batchStart = Date.now();
      let batchBytes = 0;
      let pagesProcessed = 0;

      while (state.tableIndex < BACKUP_TABLES.length) {
        const table = BACKUP_TABLES[state.tableIndex];
        if (pagesProcessed === 0 || pagesProcessed % 5 === 0) {
          await updateBackupMessage(
            adminClient,
            backupId,
            `Backup läuft: Tabelle ${table} ab Datensatz ${state.rowOffset + 1}`,
          );
        }

        const pageSize = pageSizeFor(table);
        // Retry mit Backoff — fängt transiente Cloudflare-5xx (520/521/522/524) ab.
        let data: unknown[] | null = null;
        let lastErr: string | null = null;
        for (let attempt = 1; attempt <= 5; attempt++) {
          try {
            const res = await adminClient
              .from(table)
              .select("*")
              .range(state.rowOffset, state.rowOffset + pageSize - 1);
            if (res.error) {
              lastErr = res.error.message;
              const transient = /502|503|504|520|521|522|524|<!DOCTYPE|<html|Web server|Cloudflare|fetch failed|network|timeout|Unexpected token|not valid JSON/i.test(lastErr);
              if (!transient || attempt === 5) throw new Error(`Tabelle ${table}: ${lastErr}`);
            } else {
              data = res.data as unknown[];
              break;
            }
          } catch (e) {
            lastErr = e instanceof Error ? e.message : String(e);
            const transient = /502|503|504|520|521|522|524|<!DOCTYPE|<html|Web server|Cloudflare|fetch failed|network|timeout|Unexpected token|not valid JSON/i.test(lastErr);
            if (!transient || attempt === 5) throw new Error(`Tabelle ${table}: ${lastErr}`);
          }
          await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** (attempt - 1), 8000)));
        }

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
          batchBytes += size;

          if (pageRows < pageSize) {
            state.tableIndex += 1;
            state.rowOffset = 0;
            state.partIndex = 0;
          } else {
            state.rowOffset += pageRows;
          }
        }

        pagesProcessed += 1;
        await tick();

        // Budget-Check: nach großen Uploads / Zeit ausbrechen und neu triggern.
        if (Date.now() - batchStart >= BATCH_MAX_MS) break;
        if (batchBytes >= BATCH_MAX_BYTES) break;
      }

      await uploadJson(adminClient, statePath, state, true);
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

    const postPromise = runPostBackupTasks({
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
    try {
      // @ts-ignore EdgeRuntime is provided by Supabase Edge Runtime
      EdgeRuntime.waitUntil(postPromise);
    } catch (_) { /* ignore */ }

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
    console.error("Backup step failed:", errorMsg);
    const transient = /502|503|504|520|521|522|524|<!DOCTYPE|<html|Web server|Cloudflare|fetch failed|network|timeout|Unexpected token|not valid JSON|invalid JSON|empty file|transient storage/i.test(errorMsg);
    if (transient) {
      // Re-queue instead of marking the whole run failed — Supabase Storage /
      // Cloudflare gateway HTML responses are recoverable.
      await updateBackupMessage(
        adminClient,
        backupId,
        `Transienter Fehler, wird erneut versucht: ${errorMsg.slice(0, 200)}`,
      );
      await new Promise((r) => setTimeout(r, 5000));
      triggerNextStep(adminClient, params);
      return { success: true, accepted: true, backup_id: backupId, backup_status: "running" };
    }
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
