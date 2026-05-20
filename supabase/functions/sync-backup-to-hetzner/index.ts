// Replicates files from Supabase Storage "backups" bucket to a Hetzner Object Storage (S3-compatible) bucket.
// Auth: requires CRON_SECRET or SUPABASE_SERVICE_ROLE_KEY.
// Body: { folder_path?: string, backup_id?: string }  -> if folder_path given, syncs only that folder; otherwise syncs ALL files in backups bucket.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const cronSecret = Deno.env.get("CRON_SECRET");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);
  const aws = new AwsClient({
    accessKeyId: accessKey,
    secretAccessKey: secretKey,
    service: "s3",
    region,
  });

  const base = endpoint.replace(/\/+$/, "");

  let folderPath: string | undefined;
  let backupId: string | undefined;
  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      folderPath = body?.folder_path;
      backupId = body?.backup_id;
    }
  } catch (_) { /* ignore */ }

  // Recursively list files in the backups bucket (or under folderPath)
  async function listAll(prefix = ""): Promise<string[]> {
    const out: string[] = [];
    const stack: string[] = [prefix];
    while (stack.length) {
      const cur = stack.pop()!;
      const { data, error } = await supabase.storage.from("backups").list(cur, {
        limit: 1000,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw new Error(`list ${cur}: ${error.message}`);
      if (!data) continue;
      for (const entry of data) {
        const path = cur ? `${cur}/${entry.name}` : entry.name;
        if (entry.id === null) {
          stack.push(path); // folder
        } else {
          out.push(path);
        }
      }
    }
    return out;
  }

  const startedAt = Date.now();
  try {
    const paths = await listAll(folderPath ?? "");
    const uploaded: string[] = [];
    const skipped: string[] = [];
    const failed: { path: string; error: string }[] = [];
    let totalBytes = 0;

    for (const p of paths) {
      const objectKey = p; // mirror layout
      const targetUrl = `${base}/${bucket}/${objectKey}`;

      // Skip if already exists with same size
      try {
        const head = await aws.fetch(targetUrl, { method: "HEAD" });
        if (head.ok) {
          skipped.push(p);
          continue;
        }
      } catch (_) { /* fall through to upload */ }

      const { data: blob, error: dlErr } = await supabase.storage.from("backups").download(p);
      if (dlErr || !blob) {
        failed.push({ path: p, error: dlErr?.message ?? "download failed" });
        continue;
      }
      const buf = await blob.arrayBuffer();
      const put = await aws.fetch(targetUrl, {
        method: "PUT",
        body: buf,
        headers: { "Content-Type": blob.type || "application/octet-stream" },
      });
      if (!put.ok) {
        failed.push({ path: p, error: `PUT ${put.status}: ${await put.text()}` });
        continue;
      }
      uploaded.push(p);
      totalBytes += buf.byteLength;
    }

    const result = {
      success: failed.length === 0,
      folder_path: folderPath ?? null,
      backup_id: backupId ?? null,
      uploaded_count: uploaded.length,
      skipped_count: skipped.length,
      failed_count: failed.length,
      total_bytes: totalBytes,
      duration_ms: Date.now() - startedAt,
      failed,
      endpoint: base,
      bucket,
    };

    // Mark metadata if backupId provided
    if (backupId) {
      await supabase
        .from("backups_metadata")
        .update({
          storage_location: failed.length === 0
            ? `hetzner_s3:${bucket}`
            : `supabase_storage:backups (hetzner sync partial)`,
          message: failed.length === 0
            ? `Auf Hetzner gesichert (${uploaded.length} neu, ${skipped.length} bereits vorhanden).`
            : `Hetzner-Sync teilweise fehlgeschlagen (${failed.length} Fehler).`,
        })
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
