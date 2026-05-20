// Replicates files from Supabase Storage "backups" bucket to a Hetzner Storage Box (WebDAV).
//
// Secrets (re-used from prior S3 naming for compatibility):
//   HETZNER_S3_ENDPOINT  -> WebDAV base host, e.g. "u597373.your-storagebox.de" (https:// is added if missing)
//   HETZNER_S3_BUCKET    -> Root folder inside the storage box, e.g. "backup/alix-backup"
//   HETZNER_S3_ACCESS_KEY-> WebDAV username (e.g. u597373 or sub-account)
//   HETZNER_S3_SECRET_KEY-> WebDAV password
//
// Auth: requires CRON_SECRET or SUPABASE_SERVICE_ROLE_KEY.
// Body: { folder_path?: string, backup_id?: string }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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

function normalizeBase(endpoint: string): string {
  let e = endpoint.trim();
  e = e.replace(/^\/+/, "");                 // strip leading slashes
  if (!/^https?:\/\//i.test(e)) e = `https://${e}`;
  return e.replace(/\/+$/, "");              // strip trailing slash
}

function joinUrl(base: string, ...parts: string[]): string {
  const tail = parts
    .filter(Boolean)
    .map((p) => p.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .map((p) => p.split("/").map(encodeURIComponent).join("/"))
    .join("/");
  return tail ? `${base}/${tail}` : base;
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

  const endpointRaw = Deno.env.get("HETZNER_S3_ENDPOINT");
  const rootFolder = Deno.env.get("HETZNER_S3_BUCKET") ?? "";
  const username = Deno.env.get("HETZNER_S3_ACCESS_KEY");
  const password = Deno.env.get("HETZNER_S3_SECRET_KEY");

  if (!endpointRaw || !username || !password) {
    return json({ error: "Hetzner WebDAV secrets not configured (need HETZNER_S3_ENDPOINT, HETZNER_S3_ACCESS_KEY, HETZNER_S3_SECRET_KEY)" }, 500);
  }

  const base = normalizeBase(endpointRaw);
  const authToken = "Basic " + btoa(`${username}:${password}`);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);

  let folderPath: string | undefined;
  let backupId: string | undefined;
  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      folderPath = body?.folder_path;
      backupId = body?.backup_id;
    }
  } catch (_) { /* ignore */ }

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
        if (entry.id === null) stack.push(path);
        else out.push(path);
      }
    }
    return out;
  }

  const createdDirs = new Set<string>();
  async function ensureDir(relDir: string) {
    const segs = relDir.split("/").filter(Boolean);
    let acc = "";
    for (const seg of segs) {
      acc = acc ? `${acc}/${seg}` : seg;
      if (createdDirs.has(acc)) continue;
      const url = joinUrl(base, rootFolder, acc);
      const res = await fetch(url, {
        method: "MKCOL",
        headers: { "Authorization": authToken },
      });
      // 201 created, 405 already exists -> both OK
      if (res.status !== 201 && res.status !== 405 && res.status !== 301) {
        const txt = await res.text().catch(() => "");
        // 207/200 sometimes returned; only treat hard errors
        if (res.status >= 400 && res.status !== 405) {
          throw new Error(`MKCOL ${url} -> ${res.status}: ${txt.slice(0, 200)}`);
        }
      } else {
        await res.body?.cancel();
      }
      createdDirs.add(acc);
    }
  }

  const startedAt = Date.now();
  try {
    const paths = await listAll(folderPath ?? "");
    const uploaded: string[] = [];
    const skipped: string[] = [];
    const failed: { path: string; error: string }[] = [];
    let totalBytes = 0;

    for (const p of paths) {
      try {
        const dir = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
        if (dir) await ensureDir(dir);

        const targetUrl = joinUrl(base, rootFolder, p);

        // HEAD to check existence
        const head = await fetch(targetUrl, { method: "HEAD", headers: { "Authorization": authToken } });
        await head.body?.cancel();
        if (head.ok) {
          skipped.push(p);
          continue;
        }

        const { data: blob, error: dlErr } = await supabase.storage.from("backups").download(p);
        if (dlErr || !blob) {
          failed.push({ path: p, error: dlErr?.message ?? "download failed" });
          continue;
        }
        const buf = await blob.arrayBuffer();
        const put = await fetch(targetUrl, {
          method: "PUT",
          headers: {
            "Authorization": authToken,
            "Content-Type": blob.type || "application/octet-stream",
            "Content-Length": String(buf.byteLength),
          },
          body: buf,
        });
        const putTxt = put.ok ? "" : await put.text().catch(() => "");
        if (!put.ok) {
          failed.push({ path: p, error: `PUT ${put.status}: ${putTxt.slice(0, 200)}` });
          continue;
        }
        uploaded.push(p);
        totalBytes += buf.byteLength;
      } catch (e) {
        failed.push({ path: p, error: e instanceof Error ? e.message : String(e) });
      }
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
      failed: failed.slice(0, 20),
      endpoint: base,
      root: rootFolder,
    };

    if (backupId) {
      await supabase
        .from("backups_metadata")
        .update({
          storage_location: failed.length === 0
            ? `hetzner_webdav:${rootFolder || "/"}`
            : `supabase_storage:backups (hetzner sync partial)`,
          message: failed.length === 0
            ? `Auf Hetzner Storage Box gesichert (${uploaded.length} neu, ${skipped.length} bereits vorhanden).`
            : `Hetzner-Sync teilweise fehlgeschlagen (${failed.length} Fehler).`,
        })
        .eq("id", backupId);
    }

    // Always return 200 so caller doesn't blow up; success flag carries truth
    return json(result, 200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Hetzner WebDAV sync failed:", msg);
    if (backupId) {
      await supabase
        .from("backups_metadata")
        .update({ message: `Hetzner-Sync fehlgeschlagen: ${msg}` })
        .eq("id", backupId);
    }
    return json({ success: false, error: msg, fallback: true }, 200);
  }
});
