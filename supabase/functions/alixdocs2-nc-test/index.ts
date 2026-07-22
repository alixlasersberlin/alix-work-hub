// ALIXDocs AI 2.0 – Nextcloud Verbindungstest
// PROPFIND auf den User-Root prüft URL + Credentials.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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
  const basic = btoa(`${server.username}:${password}`);

  try {
    const resp = await fetch(davUrl, {
      method: "PROPFIND",
      headers: {
        Authorization: `Basic ${basic}`,
        Depth: "0",
        "Content-Type": "application/xml",
      },
    });
    const text = await resp.text();
    return json(resp.ok || resp.status === 207 ? 200 : 400, {
      ok: resp.ok || resp.status === 207,
      status: resp.status,
      dav_url: davUrl,
      response_preview: text.slice(0, 500),
    });
  } catch (e) {
    return json(500, { error: "connection_failed", detail: (e as Error).message });
  }
});
