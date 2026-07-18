// alixsmart-portal
// Public self-service registration portal for AlixSmart invites.
// Actions:
//   POST { action: "validate", token }
//     -> { ok, customer: {company_name, contact_name, email}, devices: [{id, serial_number, device_name, device_model, registration_status}] }
//   POST { action: "register", token, alixsmart_user_id, alixsmart_email?, alixsmart_phone?, device_ids?: string[] }
//     -> { ok }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function loadInvite(token: string) {
  if (!token || typeof token !== "string" || token.length < 16 || token.length > 128) return null;
  const hash = await sha256Hex(token);
  const { data } = await admin
    .from("alixsmart_registration_invites")
    .select("id, customer_id, single_use, expires_at, used_at, revoked_at")
    .eq("token_hash", hash)
    .maybeSingle();
  if (!data) return null;
  if (data.revoked_at) return null;
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return null;
  if (data.single_use && data.used_at) return null;
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");
    const token = String(body?.token ?? "");

    const invite = await loadInvite(token);
    if (!invite) return json({ error: "Einladung ungültig oder abgelaufen" }, 404);

    const customerId = invite.customer_id as string;

    if (action === "validate") {
      const { data: cust } = await admin
        .from("customers")
        .select("id, company_name, contact_name, email, phone")
        .eq("id", customerId)
        .maybeSingle();
      if (!cust) return json({ error: "Kunde nicht gefunden" }, 404);

      const { data: devices } = await admin
        .from("alixsmart_device_links")
        .select("id, serial_number, device_name, device_model, registration_status, registered_at")
        .eq("alixwork_customer_id", customerId)
        .order("created_at", { ascending: true });

      return json({
        ok: true,
        customer: {
          company_name: cust.company_name,
          contact_name: cust.contact_name,
          email: cust.email,
          phone: cust.phone,
        },
        devices: devices ?? [],
      });
    }

    if (action === "register") {
      const asUserId = String(body?.alixsmart_user_id ?? "").trim();
      const asEmail = body?.alixsmart_email ? String(body.alixsmart_email).trim() : null;
      const asPhone = body?.alixsmart_phone ? String(body.alixsmart_phone).trim() : null;
      const deviceIds: string[] = Array.isArray(body?.device_ids) ? body.device_ids.map(String) : [];

      if (!asUserId || asUserId.length > 128) return json({ error: "AlixSmart User-ID fehlt" }, 400);
      if (asEmail && asEmail.length > 255) return json({ error: "E-Mail zu lang" }, 400);
      if (asPhone && asPhone.length > 64) return json({ error: "Telefon zu lang" }, 400);

      const nowIso = new Date().toISOString();

      // Upsert customer link → registered
      const { data: linkRow } = await admin
        .from("alixsmart_customer_links")
        .select("id")
        .eq("alixwork_customer_id", customerId)
        .maybeSingle();

      const linkPayload: any = {
        alixwork_customer_id: customerId,
        alixsmart_user_id: asUserId,
        alixsmart_email: asEmail,
        alixsmart_phone: asPhone,
        match_status: "registered",
        match_method: "self_registration",
        manually_confirmed: false,
        registered_at: nowIso,
        last_checked_at: nowIso,
      };
      let linkId = linkRow?.id;
      if (linkId) {
        await admin.from("alixsmart_customer_links").update(linkPayload).eq("id", linkId);
      } else {
        const { data: inserted } = await admin
          .from("alixsmart_customer_links")
          .insert(linkPayload)
          .select("id")
          .single();
        linkId = inserted?.id;
      }

      // Devices → registered (only whitelisted IDs that belong to this customer)
      if (deviceIds.length) {
        await admin
          .from("alixsmart_device_links")
          .update({
            registration_status: "registered",
            registered_at: nowIso,
            last_checked_at: nowIso,
            customer_link_id: linkId ?? null,
          })
          .eq("alixwork_customer_id", customerId)
          .in("id", deviceIds);
      }

      // Mark invite used
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
      await admin
        .from("alixsmart_registration_invites")
        .update({ used_at: nowIso, used_ip: ip })
        .eq("id", invite.id);

      await admin.from("alixsmart_match_logs").insert({
        customer_id: customerId,
        decision: "registered",
        source: "self_registration",
        compared_fields: { devices_registered: deviceIds.length, alixsmart_user_id: asUserId },
      }).then(() => {}, () => {});

      return json({ ok: true });
    }

    return json({ error: "Unbekannte Aktion" }, 400);
  } catch (e: any) {
    return json({ error: e?.message ?? "Fehler" }, 500);
  }
});
