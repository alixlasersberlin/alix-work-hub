// Public unsubscribe endpoint for Alix MailCenter (marketing/newsletter).
// Writes to public.mail_unsubscribes with service role. Does not delete or
// expose any customer data. GET supports a lookup by email; POST records
// the unsubscribe.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isValidEmail(s: unknown): s is string {
  return typeof s === "string" &&
    s.length <= 320 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);

    if (req.method === "GET") {
      const email = (url.searchParams.get("email") ?? "").toLowerCase().trim();
      if (!isValidEmail(email)) return json({ valid: false }, 200);
      const { data } = await supabase
        .from("mail_unsubscribes")
        .select("id")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();
      return json({ valid: true, already: !!data, email });
    }

    if (req.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405);
    }

    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? "").toLowerCase().trim();
    const reason = body.reason ? String(body.reason).slice(0, 500) : null;
    const source = body.source ? String(body.source).slice(0, 100) : "public_form";

    if (!isValidEmail(email)) return json({ error: "invalid_email" }, 400);

    // Idempotent: if already exists, just return ok.
    const { data: existing } = await supabase
      .from("mail_unsubscribes")
      .select("id")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return json({ ok: true, already: true });
    }

    // Try to find a customer_id by email (best effort, not exposed back)
    let customer_id: string | null = null;
    try {
      const { data: cust } = await supabase
        .from("customers")
        .select("id")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();
      customer_id = cust?.id ?? null;
    } catch {
      // ignore
    }

    const { error: insertErr } = await supabase
      .from("mail_unsubscribes")
      .insert({ email, reason, source, customer_id, status: "unsubscribed" });

    if (insertErr) {
      console.error("unsubscribe insert error:", insertErr);
      return json({ error: "insert_failed" }, 500);
    }

    // Best-effort: log an unsubscribe event on the most recent matching mail_messages
    try {
      const { data: lastMsg } = await supabase
        .from("mail_messages")
        .select("id")
        .ilike("to_email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastMsg?.id) {
        await supabase.from("mail_events").insert({
          message_id: lastMsg.id,
          event_type: "unsubscribed",
          event_data: { source, reason },
        });
        await supabase
          .from("mail_messages")
          .update({ unsubscribed_at: new Date().toISOString() })
          .eq("id", lastMsg.id);
      }
    } catch (e) {
      console.warn("event log skipped:", e);
    }

    return json({ ok: true });
  } catch (err) {
    console.error("mail-unsubscribe error", err);
    return json({ error: String(err) }, 500);
  }
});
