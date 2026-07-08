// Replicates files from Supabase Storage "backups" bucket to a Hetzner Object Storage (S3-compatible) bucket.
// Auth: requires CRON_SECRET or SUPABASE_SERVICE_ROLE_KEY.
// Body: { folder_path?: string, backup_id?: string, mirror_buckets?: boolean, buckets?: string[] }
// Optimizations:
//   - Parallel uploads (concurrency PARALLEL)
//   - Self-continuation: when TIME_BUDGET_MS elapses, re-invoke self with same body
//     (idempotent — HEAD checks skip already-uploaded files).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PARALLEL = 3;                  // concurrent uploads (low to stay under 256MB worker RAM)
const TIME_BUDGET_MS = 90_000;       // leave ~60s headroom before 150s idle timeout
const MAX_TASKS_PER_RUN = 60;        // hard cap per invocation → force continuation before OOM
const MAX_CONTINUATIONS = 40;        // safety guard against infinite loops

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseS3Error(xmlText: string) {
  const code = xmlText.match(/<Code>([^<]+)<\/Code>/i)?.[1] ?? null;
  const message = xmlText.match(/<Message>([^<]+)<\/Message>/i)?.[1] ?? null;
  return { code, message };
}

function formatS3Error(status: number, responseText: string, bucket: string, base: string, region: string) {
  const { code, message } = parseS3Error(responseText);
  if (code === "NoSuchBucket") return `Hetzner-Bucket "${bucket}" wurde nicht gefunden. Bitte Bucket-Name, Endpoint (${base}) und Region (${region}) prüfen.`;
  if (code === "AccessDenied") return `Zugriff auf Hetzner-Bucket "${bucket}" verweigert. Bitte Access Key, Secret Key und Bucket-Rechte prüfen.`;
  const detail = message || responseText.trim().slice(0, 300) || "Unbekannter S3-Fehler";
  return `S3-Fehler ${status}${code ? ` (${code})` : ""}: ${detail}`;
}

function isFatalS3Error(status: number, responseText: string) {
  const { code } = parseS3Error(responseText);
  return code === "NoSuchBucket" || code === "AccessDenied" || status === 401 || status === 403;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const cronSecret = Deno.env.get("CRON_SECRET");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  const apiKeyHeader = req.headers.get("apikey") ?? "";
  const expected = cronSecret ? `Bearer ${cronSecret}` : null;
  const isAuthorized =
    (expected && authHeader === expected) ||
    authHeader === `Bearer ${serviceRoleKey}` ||
    apiKeyHeader === serviceRoleKey;
  if (!isAuthorized) return json({ error: "Unauthorized" }, 401);

  const endpoint = Deno.env.get("HETZNER_S3_ENDPOINT");
  const region = Deno.env.get("HETZNER_S3_REGION") ?? "eu-central";
  const bucket = Deno.env.get("HETZNER_S3_BUCKET");
  const accessKey = Deno.env.get("HETZNER_S3_ACCESS_KEY");
  const secretKey = Deno.env.get("HETZNER_S3_SECRET_KEY");
  if (!endpoint || !bucket || !accessKey || !secretKey) {
    return json({ error: "Hetzner S3 secrets not configured" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const aws = new AwsClient({ accessKeyId: accessKey, secretAccessKey: secretKey, service: "s3", region });
  const base = (/^https?:\/\//i.test(endpoint) ? endpoint : `https://${endpoint}`).replace(/\/+$/, "");

  let folderPath: string | undefined;
  let backupId: string | undefined;
  let mirrorBucketsFlag = false;
  let bucketsToMirror: string[] | undefined;
  let continuation = 0;
  let requestBody: any = {};
  try {
    if (req.method === "POST") {
      requestBody = await req.json().catch(() => ({}));
      folderPath = requestBody?.folder_path;
      backupId = requestBody?.backup_id;
      mirrorBucketsFlag = requestBody?.mirror_buckets === true;
      if (Array.isArray(requestBody?.buckets)) bucketsToMirror = requestBody.buckets;
      continuation = Number(requestBody?.continuation ?? 0) || 0;
    }
  } catch (_) { /* ignore */ }

  // Recursively list files in a given Supabase Storage bucket
  async function listAll(srcBucket: string, prefix = ""): Promise<string[]> {
    const out: string[] = [];
    const stack: string[] = [prefix];
    while (stack.length) {
      const cur = stack.pop()!;
      const { data, error } = await supabase.storage.from(srcBucket).list(cur, {
        limit: 1000,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw new Error(`list ${srcBucket}/${cur}: ${error.message}`);
      if (!data) continue;
      for (const entry of data) {
        const path = cur ? `${cur}/${entry.name}` : entry.name;
        if (entry.id === null) stack.push(path);
        else out.push(path);
      }
    }
    return out;
  }

  type Task = { srcBucket: string; srcPath: string; destKey: string };

  const startedAt = Date.now();
  const uploaded: string[] = [];
  const skipped: string[] = [];
  const failed: { path: string; error: string }[] = [];
  let totalBytes = 0;
  let fatal = false;

  async function processOne(t: Task) {
    if (fatal) return;
    const targetUrl = `${base}/${bucket}/${t.destKey}`;
    // Skip if already exists
    try {
      const head = await aws.fetch(targetUrl, { method: "HEAD" });
      if (head.ok) { skipped.push(t.srcPath); return; }
    } catch (_) { /* upload */ }

    const { data: blob, error: dlErr } = await supabase.storage.from(t.srcBucket).download(t.srcPath);
    if (dlErr || !blob) { failed.push({ path: t.srcPath, error: dlErr?.message ?? "download failed" }); return; }
    const buf = await blob.arrayBuffer();
    const put = await aws.fetch(targetUrl, {
      method: "PUT",
      body: buf,
      headers: { "Content-Type": blob.type || "application/octet-stream" },
    });
    if (!put.ok) {
      const t2 = await put.text();
      failed.push({ path: t.srcPath, error: formatS3Error(put.status, t2, bucket, base, region) });
      if (isFatalS3Error(put.status, t2)) fatal = true;
      return;
    }
    uploaded.push(t.srcPath);
    totalBytes += buf.byteLength;
  }

  // Parallel worker pool with time-budget + task-count cap
  async function runPool(tasks: Task[]): Promise<{ processed: number; timedOut: boolean; capped: boolean }> {
    let idx = 0;
    let done = 0;
    let timedOut = false;
    let capped = false;
    const workers: Promise<void>[] = [];
    for (let w = 0; w < PARALLEL; w++) {
      workers.push((async () => {
        while (true) {
          if (fatal) return;
          if (Date.now() - startedAt > TIME_BUDGET_MS) { timedOut = true; return; }
          if (done >= MAX_TASKS_PER_RUN) { capped = true; return; }
          const i = idx++;
          if (i >= tasks.length) return;
          await processOne(tasks[i]);
          done++;
        }
      })());
    }
    await Promise.all(workers);
    return { processed: done, timedOut, capped };
  }

  try {
    const bucketCheck = await aws.fetch(`${base}/${bucket}?list-type=2&max-keys=1`, { method: "GET" });
    if (!bucketCheck.ok) {
      const t = await bucketCheck.text();
      throw new Error(formatS3Error(bucketCheck.status, t, bucket, base, region));
    }

    // Build unified task list: backups + optional bucket mirrors
    const tasks: Task[] = [];
    const backupPaths = await listAll("backups", folderPath ?? "");
    for (const p of backupPaths) tasks.push({ srcBucket: "backups", srcPath: p, destKey: p });

    const ALL_BUCKETS = [
      "alix-sign-pdfs","bank-offers","bug-capa-attachments","finance-documents",
      "order-invoices","production-orders","production-photos","repair-files",
    ];
    const targetBuckets = mirrorBucketsFlag ? (bucketsToMirror ?? ALL_BUCKETS) : [];
    for (const b of targetBuckets) {
      try {
        const paths = await listAll(b, "");
        for (const p of paths) tasks.push({ srcBucket: b, srcPath: p, destKey: `bucket-mirror/${b}/${p}` });
      } catch (e) {
        failed.push({ path: `${b}/*`, error: `list failed: ${e instanceof Error ? e.message : String(e)}` });
      }
    }

    const { timedOut, capped } = await runPool(tasks);

    // Self-continuation if time/task-cap ran out and there is more work (HEAD will skip done files)
    let continued = false;
    if ((timedOut || capped) && !fatal && continuation < MAX_CONTINUATIONS) {
      continued = true;
      const nextBody = { ...requestBody, continuation: continuation + 1 };
      // Fire-and-forget self invocation
      fetch(`${supabaseUrl}/functions/v1/sync-backup-to-hetzner`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceRoleKey}`,
          "apikey": serviceRoleKey,
        },
        body: JSON.stringify(nextBody),
      }).catch((e) => console.error("self-continuation invoke failed:", e));
    }

    const result = {
      success: failed.length === 0 && !timedOut,
      continued,
      continuation,
      folder_path: folderPath ?? null,
      backup_id: backupId ?? null,
      tasks_total: tasks.length,
      uploaded_count: uploaded.length,
      skipped_count: skipped.length,
      failed_count: failed.length,
      total_bytes: totalBytes,
      duration_ms: Date.now() - startedAt,
      failed,
      endpoint: base,
      bucket,
    };

    // Update metadata only on the FINAL pass (no continuation queued)
    if (backupId && !continued) {
      await supabase
        .from("backups_metadata")
        .update({
          storage_location: failed.length === 0
            ? `hetzner_s3:${bucket}`
            : `supabase_storage:backups (hetzner sync partial)`,
          message: failed.length === 0
            ? `Auf Hetzner gesichert (${uploaded.length} neu, ${skipped.length} bereits vorhanden, ${continuation + 1} Lauf/Läufe).`
            : `Hetzner-Sync teilweise fehlgeschlagen (${failed.length} Fehler, ${continuation + 1} Lauf/Läufe).`,
        })
        .eq("id", backupId);
    } else if (backupId && continued) {
      await supabase
        .from("backups_metadata")
        .update({ message: `Hetzner-Sync läuft (Lauf ${continuation + 1}, ${uploaded.length} neu, ${skipped.length} übersprungen, ${failed.length} Fehler bisher)…` })
        .eq("id", backupId);
    }

    return json(result, failed.length === 0 ? 200 : 207);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Hetzner sync failed:", msg);
    if (backupId) {
      await supabase
        .from("backups_metadata")
        .update({ message: `Hetzner-Sync fehlgeschlagen: ${msg}` })
        .eq("id", backupId);
    }
    return json({ success: false, error: msg }, 500);
  }
});
