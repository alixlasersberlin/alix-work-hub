// ALIXDocs AI 2.0 – Nextcloud Verbindungstest
// PROPFIND auf den User-Root prüft URL + Credentials.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json(401, { error: "unauthorized" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: isAdmin } = await userClient.rpc("has_role", { check_role: "Admin" });
  const { data: isSuper } = await userClient.rpc("has_role", { check_role: "Super Admin" });
  if (!isAdmin && !isSuper) return json(403, { error: "forbidden" });

  const body = await req.json().catch(() => ({}));
  const server_id = String(body?.server_id ?? "");
  if (!server_id) return json(400, { error: "server_id_required" });

  const admin = createClient(url, service);
  const { data: server, error: sErr } = await admin
    .from("alixdocs2_nc_servers")
    .select("id, base_url, username, app_password_secret_name")
    .eq("id", server_id)
    .maybeSingle();
  if (sErr || !server) return json(404, { error: "server_not_found" });

  const password = Deno.env.get(server.app_password_secret_name);
  if (!password) {
    return json(400, {
      error: "secret_missing",
      hint: `Bitte Supabase-Secret ${server.app_password_secret_name} anlegen (Nextcloud App-Password).`,
    });
  }

  const davUrl = `${server.base_url.replace(/\/$/, "")}/remote.php/dav/files/${encodeURIComponent(server.username)}/`;

  try {
    let resp: Response | null = null;
    let text = "";
    for (const candidate of passwordCandidates(password)) {
      resp = await fetch(davUrl, {
        method: "PROPFIND",
        headers: {
          Authorization: authHeaderFor(server.username, candidate),
          Depth: "0",
          "Content-Type": "application/xml",
          "User-Agent": "AlixWork-AlixDocs/2.0",
        },
      });
      text = await resp.text();
      if (resp.ok || resp.status === 207 || resp.status !== 401) break;
    }

    const ok = !!resp && (resp.ok || resp.status === 207);
    const status = resp?.status ?? 0;
    const authFailed = status === 401;

    // Ein fehlgeschlagener Nextcloud-Login ist kein Edge-Function-Fehler:
    // die UI soll die Diagnose anzeigen statt als Runtime-Error abzubrechen.
    return json(200, {
      ok,
      status,
      error: ok ? undefined : authFailed ? "nextcloud_auth_failed" : "nextcloud_connection_failed",
      hint: ok
        ? undefined
        : authFailed
          ? "Nextcloud lehnt Benutzer/App-Passwort ab. Bitte Username und ein neues Nextcloud App-Passwort prüfen. Leerzeichen im Secret werden automatisch mitgetestet."
          : "Nextcloud antwortet nicht erfolgreich. Bitte Base URL und WebDAV-Zugriff prüfen.",
      dav_url: davUrl,
      response_preview: text.slice(0, 500),
    });
  } catch (e) {
    return json(500, { error: "connection_failed", detail: (e as Error).message });
  }
});
