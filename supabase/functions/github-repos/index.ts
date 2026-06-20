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
  const token = Deno.env.get("GITHUB_TOKEN");
  if (!token) return json({ ok: false, error: "GITHUB_TOKEN fehlt" }, 400);

  try {
    const all: any[] = [];
    // First: who am I
    const meR = await fetch("https://api.github.com/user", { headers: gh(token) });
    if (!meR.ok) return json({ ok: false, error: `GitHub /user (${meR.status}): ${await meR.text()}` }, 400);
    const me = await meR.json();

    // List repos accessible to the token (user + collaborator + org member)
    for (let page = 1; page <= 5; page++) {
      const r = await fetch(
        `https://api.github.com/user/repos?per_page=100&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`,
        { headers: gh(token) },
      );
      if (!r.ok) return json({ ok: false, error: `GitHub /user/repos (${r.status}): ${await r.text()}` }, 400);
      const list = await r.json();
      if (!Array.isArray(list) || list.length === 0) break;
      all.push(...list);
      if (list.length < 100) break;
    }

    const repos = all.map((x: any) => ({
      full_name: x.full_name,
      private: x.private,
      default_branch: x.default_branch,
      updated_at: x.updated_at,
      html_url: x.html_url,
      permissions: x.permissions,
    }));
    return json({ ok: true, user: { login: me.login, name: me.name, html_url: me.html_url }, repos });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
