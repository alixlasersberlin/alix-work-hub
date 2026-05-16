import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Expose-Headers": "Content-Disposition",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: "Invalid session" }, 401);

    const { data: roleRows } = await admin
      .from("user_roles")
      .select("roles!inner(name)")
      .eq("user_id", userData.user.id);
    const roleNames = (roleRows ?? []).map((r: any) => r.roles?.name).filter(Boolean);
    if (!roleNames.includes("Admin") && !roleNames.includes("Super Admin")) {
      return json({ error: "Forbidden – Admin role required" }, 403);
    }

    const url = new URL(req.url);
    let backupId = url.searchParams.get("backup_id");
    if (!backupId && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      backupId = body.backup_id ?? null;
    }
    if (!backupId) return json({ error: "backup_id required" }, 400);

    const { data: meta, error: metaErr } = await admin
      .from("backups_metadata")
      .select("id, storage_path, started_at")
      .eq("id", backupId)
      .maybeSingle();
    if (metaErr || !meta) return json({ error: "Backup not found" }, 404);
    if (!meta.storage_path) return json({ error: "Backup has no storage path" }, 400);

    // Folder = manifest_path without trailing /manifest.json
    const folderPath = meta.storage_path.replace(/\/manifest\.json$/, "");

    // Recursively list files in folder
    const filesToZip: string[] = [];
    async function walk(prefix: string) {
      const { data, error } = await admin.storage.from("backups").list(prefix, {
        limit: 1000,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw new Error(`List ${prefix}: ${error.message}`);
      for (const entry of data ?? []) {
        if (entry.id === null) {
          await walk(`${prefix}/${entry.name}`);
        } else {
          filesToZip.push(`${prefix}/${entry.name}`);
        }
      }
    }
    await walk(folderPath);

    if (filesToZip.length === 0) {
      return json({ error: "No files in backup folder" }, 404);
    }

    const zip = new JSZip();
    for (const path of filesToZip) {
      const { data: blob, error: dlErr } = await admin.storage
        .from("backups")
        .download(path);
      if (dlErr || !blob) throw new Error(`Download ${path}: ${dlErr?.message}`);
      const relative = path.substring(folderPath.length + 1);
      zip.file(relative, await blob.arrayBuffer());
    }

    // Use STORE (no compression) to stay within edge-function CPU limits.
    // Backup payloads are mostly JSON; compression here was the bottleneck.
    const zipBuf = await zip.generateAsync({
      type: "uint8array",
      compression: "STORE",
    });

    const fileName = `backup-${backupId.slice(0, 8)}-${(meta.started_at ?? "").slice(0, 10)}.zip`;
    return new Response(zipBuf, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(zipBuf.byteLength),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("download-backup-zip failed:", msg);
    return json({ error: msg }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
