// announce-capa-cockpit
// Einmaliger Rundmail-Versand "Welcome CAPA 2.0 Cockpit" an alle aktiven Mitarbeiter.
// Schutz: fester Auslöse-Token im Header + einmalige Ausführung (app_settings-Flag).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-announce-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TRIGGER_TOKEN = "capa-cockpit-2026-09-04-kantert";
const SETTING_KEY = "capa_cockpit_announcement_sent";
const APP_URL = "https://app.alixwork.de/bug-capa/capa-cockpit";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.headers.get("x-announce-token") !== TRIGGER_TOKEN) return json({ error: "Forbidden" }, 403);

  const { data: flag } = await admin.from("app_settings").select("key").eq("key", SETTING_KEY).maybeSingle();
  if (flag) return json({ skipped: true, reason: "already sent" });

  const { data: users, error } = await admin
    .from("user_profiles")
    .select("email, full_name")
    .eq("is_active", true)
    .not("email", "is", null);
  if (error) return json({ error: error.message }, 500);

  const seen = new Set<string>();
  const recipients = (users ?? []).filter(u => {
    const e = (u.email ?? "").trim().toLowerCase();
    if (!e.includes("@") || seen.has(e)) return false;
    seen.add(e);
    return true;
  });

  let sent = 0; const failed: string[] = [];
  for (const u of recipients) {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          templateName: "capa-cockpit-announcement",
          recipientEmail: u.email,
          idempotencyKey: `capa-cockpit-announce-${(u.email ?? "").toLowerCase()}`,
          templateData: { recipientName: u.full_name ?? "", appUrl: APP_URL },
          skipDefaultCopies: true,
        }),
      });
      if (res.ok) sent++; else failed.push(`${u.email}: ${res.status}`);
    } catch (e) {
      failed.push(`${u.email}: ${String(e)}`);
    }
    await new Promise(r => setTimeout(r, 400));
  }

  await admin.from("app_settings").insert({ key: SETTING_KEY, value: JSON.stringify({ sent, at: new Date().toISOString() }) });

  return json({ sent, total: recipients.length, failed });
});
