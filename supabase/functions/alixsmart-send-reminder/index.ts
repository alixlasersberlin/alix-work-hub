// alixsmart-send-reminder
// Sendet einem Kunden eine AlixSmart-Registrierungserinnerung per Email oder SMS.
// Erzeugt bei Bedarf ein Einladungs-Token (alixsmart_registration_invites) und
// baut daraus einen Registrierungs-Link. Protokolliert in alixsmart_reminders.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const ALLOWED = new Set(["Super Admin", "Admin", "Vertrieb", "Kundenservice"]);
const INVITE_BASE = Deno.env.get("ALIXSMART_INVITE_BASE_URL") ?? "https://app.alixwork.de/alixsmart/register";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } }, auth: { persistSession: false },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims } = await userClient.auth.getClaims(token);
    if (!claims?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const { data: roleRows } = await admin
      .from("user_roles").select("roles!inner(name)").eq("user_id", userId);
    const names = (roleRows ?? []).map((r: any) => r.roles?.name).filter(Boolean);
    if (!names.some((n: string) => ALLOWED.has(n))) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const customer_ids: string[] = Array.isArray(body?.customer_ids) ? body.customer_ids : (body?.customer_id ? [body.customer_id] : []);
    const channel: "email" | "sms" = body?.channel === "sms" ? "sms" : "email";
    const customText: string | undefined = body?.message;
    if (!customer_ids.length) return json({ error: "customer_ids fehlt" }, 400);

    const results: any[] = [];
    for (let i = 0; i < customer_ids.length; i++) {
      const cid = customer_ids[i];
      // Throttle: 500ms zwischen den Sends (Resend-Ratelimit ~2/s)
      if (i > 0) await new Promise((r) => setTimeout(r, 500));
      const { data: cust } = await admin
        .from("customers").select("id, email, phone, company_name, contact_name").eq("id", cid).maybeSingle();
      if (!cust) { results.push({ customer_id: cid, ok: false, error: "Kunde nicht gefunden" }); continue; }


      // Invite-Token (30 Tage)
      const raw = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const hash = await sha256Hex(raw);
      await admin.from("alixsmart_registration_invites").insert({
        customer_id: cid,
        token_hash: hash,
        single_use: true,
        expires_at: new Date(Date.now() + 30 * 86400e3).toISOString(),
        created_by: userId,
      });
      const link = `${INVITE_BASE}?token=${raw}`;

      const name = cust.contact_name || cust.company_name || "Kunde";
      const subject = "Ihre kostenlose AlixSmart-Registrierung";
      const bodyText = customText
        ? customText.replaceAll("{{link}}", link).replaceAll("{{name}}", name)
        : `Hallo ${name},\n\nsichern Sie sich mit einem Klick Ihre AlixSmart-Registrierung und profitieren Sie von automatischen Wartungserinnerungen, Support-Tickets und Ihrer Geräteakte:\n\n${link}\n\nHerzliche Grüße\nIhr Alix-Team`;

      let ok = false, providerId: string | null = null, err: string | null = null, recipient: string | null = null;
      if (channel === "email") {
        recipient = cust.email;
        if (!recipient) { err = "Kunde hat keine E-Mail"; }
        else {
          try {
            const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE}`, apikey: SERVICE_ROLE },
              body: JSON.stringify({
                templateName: "as-customer-reminder",
                recipientEmail: recipient,
                idempotencyKey: `as-invite-${cid}-${new Date().toISOString().slice(0,10)}`,
                templateData: {
                  customerName: name,
                  kind: "registration",
                  ctaUrl: link,
                  ctaLabel: "Jetzt registrieren",
                  customMessage: customText ?? bodyText,
                },
              }),
            });
            const info: any = await resp.json().catch(() => ({}));
            ok = resp.ok;
            providerId = info?.id ?? null;
            if (!ok) err = info?.error ?? `HTTP ${resp.status}`;
          } catch (e: any) { err = e?.message ?? "send failed"; }
        }
      } else {
        recipient = cust.phone;
        if (!recipient) { err = "Kunde hat keine Telefonnummer"; }
        else {
          try {
            const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-customer-sms`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: authHeader },
              body: JSON.stringify({
                customer_id: cid,
                document_id: "00000000-0000-0000-0000-000000000000",
                phone: recipient,
                message_text: bodyText,
              }),
            });
            const info: any = await resp.json().catch(() => ({}));
            ok = resp.ok && info?.ok !== false;
            providerId = info?.sid ?? null;
            if (!ok) err = info?.error ?? `HTTP ${resp.status}`;
          } catch (e: any) { err = e?.message ?? "sms failed"; }
        }
      }

      await admin.from("alixsmart_reminders").insert({
        customer_id: cid,
        channel,
        recipient,
        message_subject: subject,
        message_content: bodyText,
        status: ok ? "sent" : "failed",
        provider_message_id: providerId,
        error_message: err,
        sent_by: userId,
        sent_at: ok ? new Date().toISOString() : null,
        failed_at: !ok ? new Date().toISOString() : null,
      });

      await admin.from("alixsmart_customer_links").upsert({
        alixwork_customer_id: cid,
        match_status: "reminded",
        last_reminder_at: new Date().toISOString(),
      }, { onConflict: "alixwork_customer_id" });

      results.push({ customer_id: cid, ok, error: err, recipient });
    }

    return json({ ok: true, sent: results.filter(r => r.ok).length, results });
  } catch (e: any) {
    return json({ error: e?.message ?? "Fehler" }, 500);
  }
});
