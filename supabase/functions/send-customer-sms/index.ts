// Sendet eine SMS mit signiertem PDF-Link an einen Kunden via Twilio Programmable Messaging.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireCallerAccess } from "../_shared/caller-access.ts";
import { smsReview } from "../_shared/sms-policy.ts";
import { maskPhone } from "../_shared/security-core.ts";
import { z } from "npm:zod@3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const ENV_SID = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
const ENV_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
const ENV_SMS_FROM = Deno.env.get("TWILIO_SMS_FROM_NUMBER") ?? "";
const ENV_WA_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM_NUMBER") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

async function loadTwilioConfig() {
  const { data } = await admin.from("sms_settings").select("account_sid, auth_token, from_number").eq("id", true).maybeSingle();
  return {
    sid: (data?.account_sid?.trim()) || ENV_SID,
    token: (data?.auth_token?.trim()) || ENV_TOKEN,
    from: (data?.from_number?.trim()) || ENV_SMS_FROM || ENV_WA_FROM.replace(/^whatsapp:/i, ""),
  };
}

const ALLOWED_ROLES = new Set([
  "Super Admin",
  "Admin",
  "Vertrieb",
  "Kundenservice",
  "Finance",
  "Service",
  "Serviceleitung",
  "Reparaturannahme",
  "Technik",
]);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeE164(raw: string): string | null {
  if (!raw) return null;
  let s = raw.trim().replace(/[\s\-().]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (s.startsWith("0")) s = "+49" + s.slice(1);
  if (!s.startsWith("+")) s = "+" + s;
  return /^\+[1-9]\d{6,14}$/.test(s) ? s : null;
}

async function ensureDownloadToken(documentId: string): Promise<{ token: string; file_name: string } | null> {
  const { data: doc } = await admin
    .from("order_documents")
    .select("id, download_token, file_name")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc) return null;
  if (doc.download_token && doc.download_token.length >= 16) {
    return { token: doc.download_token, file_name: doc.file_name };
  }
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const { error } = await admin
    .from("order_documents")
    .update({ download_token: token })
    .eq("id", documentId);
  if (error) return null;
  return { token, file_name: doc.file_name };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    const access = await requireCallerAccess(req, corsHeaders, [...ALLOWED_ROLES]);
    if ('response' in access) return access.response;
    const userId = access.user.id;
    const parsed = z.object({
      customer_id:z.string().uuid(),order_id:z.string().uuid().nullable().optional(),document_id:z.string().uuid(),
      phone:z.string().max(40),message_text:z.string().trim().min(1).max(1500),
      document_type:z.string().max(100).nullable().optional(),document_number:z.string().max(100).nullable().optional(),
      recipient_name:z.string().max(200).nullable().optional(),base_url:z.string().max(255).optional(),
      alternative_phone_confirmed:z.boolean().optional(),alternative_phone_reason:z.string().max(500).optional(),
    }).safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
    const body = parsed.data;
    const {
      customer_id,
      order_id,
      document_id,
      document_type,
      document_number,
      recipient_name,
      phone,
      message_text,
      base_url,
    } = body ?? {};

    if (!customer_id || !document_id || !message_text || !phone) {
      return json({ error: "Pflichtfelder fehlen (customer_id, document_id, phone, message_text)." }, 400);
    }

    const { data: doc, error: docError } = await access.caller.from('order_documents').select('id,order_id,document_type').eq('id',document_id).maybeSingle();
    if (docError || !doc) return json({error:'Dokument nicht zugänglich'},404);
    const { data: order, error: orderError } = await access.caller.from('orders').select('id,customer_id,order_number,source_system').eq('id',doc.order_id).maybeSingle();
    if (orderError || !order || order.customer_id !== customer_id || (order_id && order_id !== order.id)) return json({error:'Dokument, Auftrag und Kunde stimmen nicht überein'},403);
    const { data: customer, error: customerError } = await access.caller.from('customers').select('id,phone,company_name,contact_name,source_system').eq('id',customer_id).maybeSingle();
    if (customerError || !customer || customer.source_system !== order.source_system || !access.tenants.some(t => t.zoho_source_system === order.source_system)) return json({error:'Kunde nicht zugänglich'},403);
    const { data: overridePermission } = await access.caller.rpc('security_has_permission',{_user_id:userId,_permission_key:'sms.send_alternative_phone'});
    const canOverride = access.roles.some(r => r === 'Admin' || r === 'Super Admin') || overridePermission === true;
    const review = smsReview(phone,[customer.phone],canOverride,body.alternative_phone_confirmed,body.alternative_phone_reason);
    if ('error' in review) return json({error:review.error},review.status);
    const to = review.phone;
    // Durable server-originated intent must exist before token creation or sending.
    const attemptId = crypto.randomUUID();
    const { error: auditError } = await admin.from('audit_logs').insert({user_id:userId,action:'sms_send_requested',module:'sms',record_id:doc.id,details:{attempt_id:attemptId,order_id:order.id,order_number:order.order_number,customer_id:customer.id,alternative_phone:review.alternative,reason:review.reason,destination_masked:maskPhone(to)}});
    if (auditError) return json({error:'Versandprotokoll konnte nicht gespeichert werden'},503);

    const cfg = await loadTwilioConfig();
    if (!cfg.sid || !cfg.token || !cfg.from) {
      return json({ error: "Twilio-Zugangsdaten unvollständig (bitte in SMS-Konfiguration setzen)." }, 500);
    }

    // Build signed link
    const tk = await ensureDownloadToken(String(document_id));
    if (!tk) return json({ error: "PDF konnte nicht gefunden werden." }, 404);

    const origin = "https://alixwork.de";
    const link = `${origin}/d/${tk.token}`;

    const finalText = String(message_text).replace(/\{\{link\}\}/g, link);
    if (finalText.length > 1500) return json({ error: "SMS-Text zu lang." }, 400);

    // Send via Twilio
    const url = `https://api.twilio.com/2010-04-01/Accounts/${cfg.sid}/Messages.json`;
    const auth = btoa(`${cfg.sid}:${cfg.token}`);
    const form = new URLSearchParams({ To: to, From: cfg.from, Body: finalText });

    let twilioSid: string | null = null;
    let twilioStatus = "queued";
    let errorMessage: string | null = null;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        errorMessage = `Twilio ${res.status}; Code ${typeof data?.code === 'number' ? data.code : 'unbekannt'}`;
        twilioStatus = "failed";
      } else {
        twilioSid = data?.sid ?? null;
        twilioStatus = data?.status ?? "sent";
      }
    } catch (e: any) {
      errorMessage = "Twilio-Verbindung nicht bestätigt; nicht automatisch erneut senden";
      twilioStatus = "failed";
    }

    // Log
    const { error: historyError } = await admin.from("customer_sms_logs").insert({
      customer_id,
      order_id: order.id,
      document_id,
      document_type: doc.document_type,
      document_number: order.order_number,
      recipient_name: customer.contact_name ?? customer.company_name,
      phone: to,
      message_text: finalText,
      link_url: link,
      twilio_sid: twilioSid,
      status: twilioStatus,
      error_message: errorMessage,
      sent_by: userId,
    });
    await admin.from('audit_logs').insert({user_id:userId,action:'sms_send_result',module:'sms',record_id:doc.id,details:{attempt_id:attemptId,status:twilioStatus,provider_sid:twilioSid,history_saved:!historyError,destination_masked:maskPhone(to)}});
    if (historyError && !errorMessage) return json({ok:true,sid:twilioSid,status:twilioStatus,warning:'Versand erfolgt; Historie unvollständig. Nicht erneut senden.'});

    if (errorMessage) {
      const friendly = /region indicated|21408/i.test(errorMessage)
        ? `SMS in dieses Land ist bei Twilio nicht freigeschaltet (${to.slice(0, 3)}…). Bitte Geo-Berechtigung in Twilio aktivieren.`
        : errorMessage;
      return json({ ok: false, error: friendly }, 200);
    }
    return json({ ok: true, sid: twilioSid, status: twilioStatus, link });
  } catch (e: any) {
    return json({ error: e?.message ?? "Unbekannter Fehler" }, 500);
  }
});
