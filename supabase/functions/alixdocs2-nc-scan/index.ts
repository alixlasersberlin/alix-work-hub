// ALIXDocs AI 2.0 – Nextcloud Scan
// PROPFIND rekursiv, neue/aktualisierte Dateien nach alixdocs2_documents importieren.
// Bleibt idempotent (unique nc_server_id + nc_path).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const base64Utf8 = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const authHeaderFor = (username: string, password: string) => `Basic ${base64Utf8(`${username}:${password}`)}`;

const passwordCandidates = (password: string) => {
  const values = [password, password.trim(), password.replace(/\s+/g, ""), password.trim().replace(/\s+/g, "")];
  return [...new Set(values)].filter(Boolean);
};

const encodePath = (path: string) =>
  path
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");

interface NcEntry {
  href: string;
  is_dir: boolean;
  etag?: string;
  size?: number;
  mime?: string;
  last_modified?: string;
  display_name?: string;
}

function parsePropfind(xml: string, davBase: string): NcEntry[] {
  const entries: NcEntry[] = [];
  const responseRegex = /<d:response[^>]*>([\s\S]*?)<\/d:response>/gi;
  let m: RegExpExecArray | null;
  while ((m = responseRegex.exec(xml))) {
    const block = m[1];
    const href = (/<d:href[^>]*>([\s\S]*?)<\/d:href>/i.exec(block)?.[1] ?? "").trim();
    if (!href) continue;
    const isDir = /<d:resourcetype>[\s\S]*<d:collection[\s\S]*<\/d:resourcetype>/i.test(block);
    const etag = /<d:getetag[^>]*>"?([^<"]+)"?<\/d:getetag>/i.exec(block)?.[1];
    const size = Number(/<d:getcontentlength[^>]*>(\d+)<\/d:getcontentlength>/i.exec(block)?.[1] ?? "0") || undefined;
    const mime = /<d:getcontenttype[^>]*>([^<]+)<\/d:getcontenttype>/i.exec(block)?.[1];
    const lm = /<d:getlastmodified[^>]*>([^<]+)<\/d:getlastmodified>/i.exec(block)?.[1];
    const dn = /<d:displayname[^>]*>([^<]*)<\/d:displayname>/i.exec(block)?.[1];
    entries.push({
      href: decodeURIComponent(href),
      is_dir: isDir,
      etag: etag?.trim(),
      size,
      mime: mime?.trim(),
      last_modified: lm?.trim(),
      display_name: dn?.trim(),
    });
  }
  // remove the folder itself (first entry equals davBase)
  return entries.filter((e) => !e.href.endsWith(davBase) && !e.is_dir);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(url, service);

  // Auth: entweder Admin/Super Admin oder service-role (Cron)
  const authHeader = req.headers.get("Authorization") ?? "";
  const isServiceCall = authHeader === `Bearer ${service}`;
  if (!isServiceCall) {
    if (!authHeader.startsWith("Bearer ")) return json(401, { error: "unauthorized" });
    const uc = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: isAdmin } = await uc.rpc("has_role", { check_role: "Admin" });
    const { data: isSuper } = await uc.rpc("has_role", { check_role: "Super Admin" });
    if (!isAdmin && !isSuper) return json(403, { error: "forbidden" });
  }

  const body = await req.json().catch(() => ({}));
  const folder_id = body?.folder_id ? String(body.folder_id) : null;

  // Ordner-Auswahl: einer explizit, sonst alle aktiven mit fälligem Poll-Intervall
  let folderQuery = admin
    .from("alixdocs2_nc_watched_folders")
    .select("id, server_id, path, recursive, poll_interval_min, last_scanned_at, active")
    .eq("active", true);
  if (folder_id) folderQuery = folderQuery.eq("id", folder_id);
  const { data: folders, error: fErr } = await folderQuery;
  if (fErr) return json(500, { error: fErr.message });

  const results: any[] = [];
  const now = Date.now();

  for (const folder of folders ?? []) {
    if (!folder_id && folder.last_scanned_at) {
      const dueAt = new Date(folder.last_scanned_at).getTime() + folder.poll_interval_min * 60_000;
      if (dueAt > now) continue; // noch nicht fällig
    }

    const { data: server } = await admin
      .from("alixdocs2_nc_servers")
      .select("id, base_url, username, app_password_secret_name, active")
      .eq("id", folder.server_id)
      .maybeSingle();
    if (!server || !server.active) continue;

    const password = Deno.env.get(server.app_password_secret_name);
    if (!password) {
      await admin.from("alixdocs2_nc_sync_runs").insert({
        server_id: server.id,
        folder_id: folder.id,
        finished_at: new Date().toISOString(),
        status: "error",
        error: `Secret ${server.app_password_secret_name} nicht gesetzt.`,
      });
      continue;
    }

    const cleanPath = folder.path.replace(/^\/+/, "").replace(/\/+$/, "");
    const encodedUser = encodeURIComponent(server.username);
    const encodedPath = encodePath(cleanPath);
    const davBase = `/remote.php/dav/files/${encodedUser}/${encodedPath ? `${encodedPath}/` : ""}`;
    const davUrl = `${server.base_url.replace(/\/$/, "")}${davBase}`;

    const runRow = await admin
      .from("alixdocs2_nc_sync_runs")
      .insert({ server_id: server.id, folder_id: folder.id, status: "running" })
      .select("id")
      .single();
    const runId = runRow.data?.id;

    try {
      let resp: Response | null = null;
      for (const candidate of passwordCandidates(password)) {
        resp = await fetch(davUrl, {
          method: "PROPFIND",
          headers: {
            Authorization: authHeaderFor(server.username, candidate),
            Depth: folder.recursive ? "infinity" : "1",
            "Content-Type": "application/xml",
            "User-Agent": "AlixWork-AlixDocs/2.0",
          },
        });
        if (resp.ok || resp.status === 207 || resp.status !== 401) break;
      }
      if (!resp) throw new Error("PROPFIND fehlgeschlagen");
      if (!resp.ok && resp.status !== 207) throw new Error(`PROPFIND ${resp.status}`);
      const xml = await resp.text();
      const entries = parsePropfind(xml, davBase);

      let filesNew = 0;
      let filesUpdated = 0;

      for (const e of entries) {
        // e.href is full absolute path incl. /remote.php/dav/files/<user>/...
        const relPath = e.href.split(`/remote.php/dav/files/${server.username}/`)[1]
          ?? e.href.split(`/remote.php/dav/files/${encodedUser}/`)[1]
          ?? e.href;
        const title = e.display_name || relPath.split("/").pop() || relPath;

        const { data: existing } = await admin
          .from("alixdocs2_documents")
          .select("id, etag")
          .eq("nc_server_id", server.id)
          .eq("nc_path", relPath)
          .maybeSingle();

        if (!existing) {
          await admin.from("alixdocs2_documents").insert({
            nc_server_id: server.id,
            nc_path: relPath,
            etag: e.etag,
            size_bytes: e.size,
            mime: e.mime,
            title,
            status: "importiert",
          });
          filesNew++;
        } else if (existing.etag !== e.etag) {
          // Vorherige Version archivieren
          const { count } = await admin
            .from("alixdocs2_versions")
            .select("id", { count: "exact", head: true })
            .eq("document_id", existing.id);
          await admin.from("alixdocs2_versions").insert({
            document_id: existing.id,
            version: (count ?? 0) + 1,
            etag: existing.etag,
            nc_path: relPath,
            note: "auto: etag changed",
          });
          await admin
            .from("alixdocs2_documents")
            .update({ etag: e.etag, size_bytes: e.size, mime: e.mime, status: "importiert" })
            .eq("id", existing.id);
          filesUpdated++;
        }
      }

      await admin.from("alixdocs2_nc_sync_runs").update({
        finished_at: new Date().toISOString(),
        files_seen: entries.length,
        files_new: filesNew,
        files_updated: filesUpdated,
        status: "ok",
      }).eq("id", runId);
      await admin.from("alixdocs2_nc_watched_folders")
        .update({ last_scanned_at: new Date().toISOString() })
        .eq("id", folder.id);

      results.push({ folder_id: folder.id, files_seen: entries.length, files_new: filesNew, files_updated: filesUpdated });
    } catch (err) {
      await admin.from("alixdocs2_nc_sync_runs").update({
        finished_at: new Date().toISOString(),
        status: "error",
        error: (err as Error).message,
      }).eq("id", runId);
      results.push({ folder_id: folder.id, error: (err as Error).message });
    }
  }

  return json(200, { ok: true, folders_processed: results.length, results });
});
