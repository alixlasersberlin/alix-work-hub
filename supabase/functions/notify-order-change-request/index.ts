import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { id } = await req.json();
    if (!id) return json({ error: "id required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: cr } = await supabase
      .from("order_change_requests")
      .select("id, order_number, order_id, requested_by_name, reason, proposed_changes")
      .eq("id", id)
      .maybeSingle();
    if (!cr) return json({ error: "not found" }, 404);

    // Super Admin Emails abfragen
    const { data: adminRows } = await supabase
      .from("user_roles")
      .select("user_id, roles!inner(name), user_profiles!inner(email, full_name)")
      .eq("roles.name", "Super Admin");
    const recipients = Array.from(
      new Set(((adminRows ?? []) as any[]).map((r) => r.user_profiles?.email).filter(Boolean)),
    );
    if (recipients.length === 0) return json({ ok: true, sent: 0 });

    const RESEND = Deno.env.get("RESEND_API_KEY");
    if (!RESEND) return json({ ok: true, sent: 0, note: "no RESEND_API_KEY" });

    const changesList = Object.entries((cr.proposed_changes || {}) as Record<string, unknown>)
      .map(([k, v]) => `<li><strong>${k}:</strong> ${escapeHtml(String(typeof v === "object" ? JSON.stringify(v) : v))}</li>`)
      .join("");
    const html = `
      <div style="font-family:sans-serif;max-width:640px">
        <h2>Neue Auftrags-Änderung zur Freigabe</h2>
        <p><strong>${escapeHtml(cr.requested_by_name || "Mitarbeiter")}</strong> möchte Auftrag
        <strong>${escapeHtml(cr.order_number || "")}</strong> ändern.</p>
        ${cr.reason ? `<p><em>Begründung:</em> ${escapeHtml(cr.reason)}</p>` : ""}
        <p><strong>Vorgeschlagene Änderungen:</strong></p>
        <ul>${changesList || "<li>(keine)</li>"}</ul>
        <p><a href="https://app.alixwork.de/freigaben">Zur Freigabe öffnen →</a></p>
      </div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "AlixWork <notify@notify.alixlasers.ai>",
        to: recipients,
        bcc: ["rde@alix-lasers.com"],
        subject: `Freigabe erforderlich: Auftrag ${cr.order_number ?? ""}`,
        html,
      }),
    });
    const body = await res.text();
    return json({ ok: res.ok, status: res.status, body });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
