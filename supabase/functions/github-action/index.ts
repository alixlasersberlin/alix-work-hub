const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const { action } = await req.json().catch(() => ({ action: "" }));
  const token = Deno.env.get("GITHUB_TOKEN");

  let repo: string | null = null;
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (SUPABASE_URL && SERVICE) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?key=eq.github_repo&select=value`, {
        headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
      });
      if (r.ok) {
        const rows = await r.json();
        if (Array.isArray(rows) && rows[0]?.value) repo = String(rows[0].value);
      }
    }
  } catch (_) { /* ignore */ }
  if (!repo) repo = Deno.env.get("GITHUB_REPO") ?? null;

  if (!token || !repo) {
    return new Response(JSON.stringify({ ok: false, message: "GitHub-Verbindung nicht konfiguriert (GITHUB_TOKEN/REPO fehlen)." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }


  // Lovable's GitHub sync handles commit/push/pull automatically.
  // For 'tag', create a release tag from the latest commit.
  if (action === "tag") {
    try {
      const branchR = await fetch(`https://api.github.com/repos/${repo}`, { headers: { Authorization: `Bearer ${token}`, "User-Agent": "alix-backup" } });
      const branch = (await branchR.json())?.default_branch ?? "main";
      const head = await fetch(`https://api.github.com/repos/${repo}/git/ref/heads/${branch}`, { headers: { Authorization: `Bearer ${token}`, "User-Agent": "alix-backup" } });
      const sha = (await head.json())?.object?.sha;
      const tagName = `v${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12)}`;
      const res = await fetch(`https://api.github.com/repos/${repo}/git/refs`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "User-Agent": "alix-backup", "Content-Type": "application/json" },
        body: JSON.stringify({ ref: `refs/tags/${tagName}`, sha }),
      });
      const ok = res.ok;
      return new Response(JSON.stringify({ ok, tag: tagName, message: ok ? "Tag erstellt" : await res.text() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, message: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  return new Response(JSON.stringify({ ok: true, action, message: `${action} – wird von Lovable GitHub-Sync verarbeitet.` }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
