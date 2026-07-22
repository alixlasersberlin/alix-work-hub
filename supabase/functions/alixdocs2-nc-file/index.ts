// ALIXDocs AI 2.0 – Nextcloud File Proxy
// Streamt eine Datei via WebDAV nach RLS-Check. Query: ?document_id=UUID
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json(401, { error: "unauthorized" });

  const uc = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: isAdmin } = await uc.rpc("has_role", { check_role: "Admin" });
  const { data: isSuper } = await uc.rpc("has_role", { check_role: "Super Admin" });
  if (!isAdmin && !isSuper) return json(403, { error: "forbidden" });

  const u = new URL(req.url);
  const documentId = u.searchParams.get("document_id");
  const download = u.searchParams.get("download") === "1";
  if (!documentId) return json(400, { error: "document_id required" });

  const admin = createClient(url, service);
  const { data: doc, error } = await admin
    .from("alixdocs2_documents")
    .select("id, nc_path, mime, title, nc_server_id")
    .eq("id", documentId)
    .maybeSingle();
  if (error || !doc) return json(404, { error: "not_found" });

  const { data: server } = await admin
    .from("alixdocs2_nc_servers")
    .select("base_url, username, app_password_secret_name")
    .eq("id", doc.nc_server_id)
    .maybeSingle();
  if (!server) return json(404, { error: "server_missing" });

  const password = Deno.env.get(server.app_password_secret_name);
  if (!password) return json(500, { error: "secret_missing" });

  const davUrl = `${server.base_url.replace(/\/$/, "")}/remote.php/dav/files/${encodeURIComponent(server.username)}/${encodePath(doc.nc_path.replace(/^\/+/, ""))}`;
  const range = req.headers.get("Range");

  let resp: Response | null = null;
  for (const candidate of passwordCandidates(password)) {
    resp = await fetch(davUrl, {
      method: "GET",
      headers: {
        Authorization: authHeaderFor(server.username, candidate),
        "User-Agent": "AlixWork-AlixDocs/2.0",
        ...(range ? { Range: range } : {}),
      },
    });
    if (resp.ok || resp.status === 206 || resp.status !== 401) break;
  }
  if (!resp) return json(502, { error: "webdav_unreachable" });
  if (!resp.ok && resp.status !== 206) {
    return json(resp.status, { error: `webdav_${resp.status}` });
  }

  const headers = new Headers(corsHeaders);
  headers.set("Content-Type", doc.mime || resp.headers.get("Content-Type") || "application/octet-stream");
  const len = resp.headers.get("Content-Length");
  if (len) headers.set("Content-Length", len);
  const cr = resp.headers.get("Content-Range");
  if (cr) headers.set("Content-Range", cr);
  headers.set("Accept-Ranges", "bytes");
  const filename = (doc.title || doc.nc_path.split("/").pop() || "file").replace(/"/g, "");
  headers.set("Content-Disposition", `${download ? "attachment" : "inline"}; filename="${filename}"`);

  return new Response(resp.body, { status: resp.status, headers });
});
