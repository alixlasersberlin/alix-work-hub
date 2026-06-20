const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const { action } = await req.json().catch(() => ({ action: "" }));
  const token = Deno.env.get("GITHUB_TOKEN");
  const repo = Deno.env.get("GITHUB_REPO");
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
