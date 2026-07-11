import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function render(src: string, ctx: Record<string, string>): string {
  return (src || "").replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, k) => ctx[k] ?? "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } });
    const { data: claims } = await supabase.auth.getClaims(auth.replace("Bearer ",""));
    if (!claims?.claims?.sub) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });

    const { template_slug, language = "de", recipient, context = {}, event_id, subject: subjectOverride, body: bodyOverride } =
      await req.json();
    if (!recipient) return new Response(JSON.stringify({ error: "recipient required" }), { status: 400, headers: corsHeaders });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let subject = subjectOverride;
    let body = bodyOverride;
    if (template_slug && (!subject || !body)) {
      const { data: tpl } = await admin.from("esc_ech_templates")
        .select("subject, body").eq("slug", template_slug).eq("channel", "email").eq("language", language).maybeSingle();
      subject = subject ?? render(tpl?.subject ?? "", context);
      body = body ?? render(tpl?.body ?? "", context);
    }
    subject ??= "(ohne Betreff)";
    body ??= "";

    const { data: msg, error: msgErr } = await admin.from("esc_ech_messages").insert({
      channel: "email", template_slug, language, recipient, subject, body,
      status: "queued", refs: context, event_id,
    }).select().single();
    if (msgErr) throw msgErr;

    // Delegate to shared mailer
    const { error: sendErr } = await supabase.functions.invoke("send-mail", {
      body: { to: recipient, subject, html: body },
    });

    if (sendErr) {
      await admin.from("esc_ech_messages").update({ status: "failed", error: sendErr.message }).eq("id", msg.id);
      await admin.from("esc_audit_log").insert({
        entity_type: "esc_ech_message", entity_id: msg.id, action: "EMAIL_FAILED",
        user_id: claims.claims.sub, new_data: { error: sendErr.message, recipient },
      });
      return new Response(JSON.stringify({ error: sendErr.message, id: msg.id }), { status: 502, headers: corsHeaders });
    }

    await admin.from("esc_ech_messages").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", msg.id);
    await admin.from("esc_audit_log").insert({
      entity_type: "esc_ech_message", entity_id: msg.id, action: "EMAIL_SENT",
      user_id: claims.claims.sub, new_data: { recipient, subject, template_slug },
    });

    return new Response(JSON.stringify({ ok: true, id: msg.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "error" }), { status: 500, headers: corsHeaders });
  }
});
