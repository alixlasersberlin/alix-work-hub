// Temporary diagnostic endpoint — pushes synthetic outbound payloads to ALIXSMART_API_URL
// and returns the raw response. No DB writes. Public (no auth) to allow quick probing.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("ALIXSMART_API_URL") || "";
  const key = Deno.env.get("ALIXSMART_API_KEY") || "";
  if (!url || !key) {
    return new Response(JSON.stringify({ error: "ALIXSMART_API_URL / KEY missing" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const extId = new URL(req.url).searchParams.get("ext") || `diag-${Date.now()}`;
  const actions = [
    { action: "status_change",     status: "in_progress" },
    { action: "new_public_message", status: "in_progress",
      public_message: { text: "Diag: Hallo vom AlixWork-Test", sender_type: "support", created_at: new Date().toISOString() } },
    { action: "assignment_change", status: "in_progress", assigned: true },
    { action: "ticket_closed",     status: "closed", closed: true },
  ];

  const results = [];
  for (const a of actions) {
    const payload = {
      external_ticket_id: extId,
      priority: "normal",
      customer_visible_status: "Test",
      updated_at: new Date().toISOString(),
      ...a,
    };
    const t0 = Date.now();
    let res: Response | null = null;
    let body = "";
    let err: string | null = null;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key}`,
          "x-api-key": key,
        },
        body: JSON.stringify(payload),
      });
      body = (await res.text()).slice(0, 400);
    } catch (e) {
      err = (e as Error).message;
    }
    results.push({
      action: a.action,
      response_code: res?.status ?? null,
      ok: res?.ok ?? false,
      latency_ms: Date.now() - t0,
      body_preview: body,
      error: err,
    });
  }

  return new Response(JSON.stringify({ target: url, external_ticket_id: extId, results }, null, 2), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
