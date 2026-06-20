const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const token = Deno.env.get("GITHUB_TOKEN");
  const repo = Deno.env.get("GITHUB_REPO"); // owner/name
  if (!token || !repo) {
    return new Response(JSON.stringify({ repo: null, branch: null, commits: [], configured: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  try {
    const r = await fetch(`https://api.github.com/repos/${repo}`, { headers: { Authorization: `Bearer ${token}`, "User-Agent": "alix-backup" } });
    const meta = await r.json();
    const branch = meta?.default_branch ?? "main";
    const c = await fetch(`https://api.github.com/repos/${repo}/commits?sha=${branch}&per_page=20`, { headers: { Authorization: `Bearer ${token}`, "User-Agent": "alix-backup" } });
    const commits = (await c.json()) as any[];
    const out = {
      repo, branch,
      last_commit: commits?.[0] ? {
        sha: commits[0].sha,
        author: commits[0].commit?.author?.name,
        date: commits[0].commit?.author?.date,
        message: commits[0].commit?.message,
      } : null,
      commits: (commits || []).map((x) => ({
        sha: x.sha,
        author: x.commit?.author?.name,
        date: x.commit?.author?.date,
        message: (x.commit?.message || "").split("\n")[0],
      })),
    };
    return new Response(JSON.stringify(out), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e), commits: [] }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
