// alixsmart-status-inbound
// Öffentlicher Webhook: AlixSmart meldet registrierte Benutzer/Geräte an AlixWork.
// Auth via Header x-alix-key = Secret ALIXSMART_INBOUND_KEY (oder Fallback ALIXWORK_SHARED_KEY).
// Body: { entries: [{ email?, phone?, alixsmart_user_id?, serial_numbers?: string[], registered_at? }] }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-alix-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const SHARED_KEY = Deno.env.get("ALIXSMART_INBOUND_KEY") ?? Deno.env.get("ALIXWORK_SHARED_KEY") ?? "";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function normEmail(e: string | null | undefined) {
  return e ? e.trim().toLowerCase().replace(/\s+/g, "") : null;
}
function normPhone(p: string | null | undefined) {
  if (!p) return null;
  let s = p.replace(/[^0-9+]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (s.startsWith("0")) s = "+49" + s.slice(1);
  if (!s.startsWith("+")) s = "+" + s;
  return s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!SHARED_KEY) return json({ error: "Server key not configured" }, 500);
    const key = req.headers.get("x-alix-key") ?? "";
    if (key !== SHARED_KEY) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const entries = Array.isArray(body?.entries) ? body.entries : [];
    if (!entries.length) return json({ error: "entries required" }, 400);

    const results: any[] = [];
    for (const e of entries) {
      const email = normEmail(e?.email);
      const phone = normPhone(e?.phone);
      const asUserId = e?.alixsmart_user_id ? String(e.alixsmart_user_id) : null;
      const serials: string[] = Array.isArray(e?.serial_numbers) ? e.serial_numbers.filter(Boolean) : [];

      // Kunden finden: primär Email
      let customerIds: string[] = [];
      if (email) {
        const { data: byMail } = await admin
          .from("customers").select("id, email").limit(20);
        customerIds = (byMail ?? [])
          .filter((c: any) => normEmail(c.email) === email)
          .map((c: any) => c.id);
      }
      // Fallback: über Seriennummern → v_alixsmart_customer_devices
      if (!customerIds.length && serials.length) {
        const { data: dev } = await admin
          .from("v_alixsmart_customer_devices")
          .select("customer_id, serial_number")
          .in("serial_number", serials);
        customerIds = Array.from(new Set((dev ?? []).map((d: any) => d.customer_id)));
      }

      for (const cid of customerIds) {
        await admin.from("alixsmart_customer_links").upsert({
          alixwork_customer_id: cid,
          alixsmart_user_id: asUserId,
          alixsmart_email: email,
          alixsmart_phone: phone,
          match_status: "registered",
          match_score: 100,
          match_method: "inbound_webhook",
          last_checked_at: new Date().toISOString(),
          registered_at: e?.registered_at ?? new Date().toISOString(),
        }, { onConflict: "alixwork_customer_id" });

        // Geräte-Links aktualisieren
        for (const sn of serials) {
          await admin.from("alixsmart_device_links").upsert({
            alixwork_customer_id: cid,
            serial_number: sn,
            registration_status: "registered",
            registered_at: e?.registered_at ?? new Date().toISOString(),
            alixsmart_device_id: null,
            last_checked_at: new Date().toISOString(),
          }, { onConflict: "alixwork_customer_id,serial_number" });
        }

        await admin.from("alixsmart_match_logs").insert({
          customer_id: cid,
          candidate_user_id: asUserId,
          match_score: 100,
          compared_fields: { email, phone, serials },
          decision: "registered",
          source: "inbound_webhook",
        });
        results.push({ customer_id: cid, status: "registered" });
      }
    }

    return json({ ok: true, updated: results.length, results });
  } catch (e: any) {
    return json({ error: e?.message ?? "Fehler" }, 500);
  }
});
