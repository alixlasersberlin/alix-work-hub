const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const githubHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "alix-backup",
});

async function readGithubError(response: Response) {
  const text = await response.text();
  try {
    const data = JSON.parse(text);
    return data?.message || text || response.statusText;
  } catch {
    return text || response.statusText;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const token = Deno.env.get("GITHUB_TOKEN");
  const repo = Deno.env.get("GITHUB_REPO"); // owner/name
  if (!token || !repo) {
    return json({ ok: false, connected: false, configured: false, repo: repo ?? null, branch: null, commits: [], error: "GITHUB_TOKEN oder GITHUB_REPO fehlt." });
  }
  if (!/^[^/\s]+\/[^/\s]+$/.test(repo)) {
    return json({ ok: false, connected: false, configured: true, repo, branch: null, commits: [], error: "GITHUB_REPO muss im Format owner/repo gespeichert sein." });
  }
  try {
    const r = await fetch(`https://api.github.com/repos/${repo}`, { headers: githubHeaders(token) });
    if (!r.ok) {
      return json({ ok: false, connected: false, configured: true, repo, branch: null, commits: [], error: `GitHub Repository nicht erreichbar (${r.status}): ${await readGithubError(r)}` });
    }
    const meta = await r.json();
    const branch = meta?.default_branch ?? "main";
    const c = await fetch(`https://api.github.com/repos/${repo}/commits?sha=${branch}&per_page=20`, { headers: githubHeaders(token) });
    if (!c.ok) {
      return json({ ok: false, connected: false, configured: true, repo, branch, commits: [], error: `GitHub Commits nicht abrufbar (${c.status}): ${await readGithubError(c)}` });
    }
    const commitsJson = await c.json();
    const commits = Array.isArray(commitsJson) ? commitsJson : [];
    const out = {
      ok: true,
      connected: true,
      configured: true,
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
    return json(out);
  } catch (e) {
    return json({ ok: false, connected: false, configured: true, repo, branch: null, commits: [], error: String(e) });
  }
});
