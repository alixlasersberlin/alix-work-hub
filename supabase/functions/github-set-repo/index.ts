import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const gh = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "alix-backup",
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Auth: Super Admin only
  const authHeader = req.headers.get("Authorization") || "";
  const userSb = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
  const { data: u } = await userSb.auth.getUser();
  if (!u?.user) return json({ ok: false, error: "Not authenticated" }, 401);
  const { data: isAdmin } = await userSb.rpc("has_role", { check_role: "Super Admin" });
  if (!isAdmin) return json({ ok: false, error: "Forbidden – Super Admin erforderlich" }, 403);

  const body = await req.json().catch(() => ({}));
  const repo = String(body?.repo || "").trim();
  const force = body?.force === true;
  if (!/^[^/\s]+\/[^/\s]+$/.test(repo)) {
    return json({ ok: false, error: "Ungültiges Repo-Format (erwartet owner/name)" }, 400);
  }

  // Try to validate against GitHub – non-blocking when force=true
  let meta: any = null;
  let warning: string | null = null;
  const token = Deno.env.get("GITHUB_TOKEN");
  if (token) {
    const r = await fetch(`https://api.github.com/repos/${repo}`, { headers: gh(token) });
    if (r.ok) {
      meta = await r.json();
    } else {
      warning = `Repository nicht erreichbar (${r.status}). Token hat evtl. keinen Zugriff – Speichern ${force ? "erzwungen" : "abgebrochen"}.`;
      if (!force) return json({ ok: false, error: warning, can_force: true });
    }
  } else {
    warning = "GITHUB_TOKEN fehlt – Repo gespeichert, aber Verbindung kann nicht geprüft werden.";
  }

  const admin = createClient(SUPABASE_URL, SERVICE);
  const { error: upErr } = await admin
    .from("app_settings")
    .upsert({ key: "github_repo", value: repo, updated_by: u.user.id }, { onConflict: "key" });
  if (upErr) return json({ ok: false, error: upErr.message }, 500);

  return json({ ok: true, repo, default_branch: meta?.default_branch ?? null, private: meta?.private ?? null, warning });
});

