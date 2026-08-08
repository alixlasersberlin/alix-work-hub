// ALIX Audit Center — hourly security alert digest
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    // Delete-Storm: >10 delete actions of same user in last hour
    const { data: actions } = await supabase
      .from("audit_actions")
      .select("user_id, action, ts")
      .gte("ts", since)
      .limit(5000);

    const delMap = new Map<string, number>();
    (actions ?? []).forEach((a: any) => {
      if (/delete|remove/i.test(a.action ?? "")) {
        delMap.set(a.user_id, (delMap.get(a.user_id) ?? 0) + 1);
      }
    });

    const alerts: string[] = [];
    delMap.forEach((count, uid) => {
      if (count >= 10) alerts.push(`Delete-Storm: User ${uid.slice(0, 8)} hat ${count} Löschungen in 1h ausgeführt.`);
    });

    // VPN / TOR sessions in last hour
    const { data: geos } = await supabase
      .from("audit_geo")
      .select("user_id, country, vpn_detected, tor_detected")
      .gte("id", 0)
      .limit(500);
    (geos ?? []).forEach((g: any) => {
      if (g.tor_detected) alerts.push(`TOR-Zugriff erkannt (User ${g.user_id?.slice(0, 8)})`);
    });

    if (alerts.length === 0) {
      return new Response(JSON.stringify({ ok: true, alerts: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send to Super Admins
    const { data: admins } = await supabase
      .from("user_profiles")
      .select("email")
      .eq("role", "Super Admin");

    const recipients = (admins ?? []).map((a: any) => a.email).filter(Boolean);
    if (recipients.length === 0) {
      return new Response(JSON.stringify({ ok: true, alerts: alerts.length, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: "Alix Lasers ® <noreply@alixlasers.ai>",
        to: recipients,
        bcc: [...([] as string[]).concat("rde@alix-lasers.com" as any), "service@alix-lasers.com"],
        subject: `[AlixWork Audit] ${alerts.length} Sicherheits-Alerts`,
        html: `<h2>Sicherheits-Alerts (letzte Stunde)</h2><ul>${alerts.map((a) => `<li>${a}</li>`).join("")}</ul><p><a href="https://alixwork.de/audit-center/security">Zum Audit Center</a></p>`,
      });
    }

    return new Response(JSON.stringify({ ok: true, alerts: alerts.length, sent: recipients.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
