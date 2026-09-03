// WhatsApp Webhook — GET Verification + POST Inbound (Meta & Twilio)
// Idempotent, mit Kundenerkennung und Anbindung an die bestehende ac_* Struktur.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { normalizePayload, normalizeStatuses, toE164, type NormalizedMessage } from './provider.ts';
import { detectProvider, verifyMetaSignature, verifyTwilioSignature, type VerifyResult } from './verify.ts';


const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const DIRECTION_MAP = { INBOUND: 'inbound', OUTBOUND: 'outbound' } as const;

function phoneVariants(e164: string): string[] {
  const digits = e164.replace(/\D/g, '');
  const local = digits.startsWith('49') ? `0${digits.slice(2)}` : digits;
  return Array.from(new Set([e164, digits, local, `+${digits}`]));
}

/** Findet den passenden Kanal anhand der angeschriebenen Alix-Nummer. */
async function findChannel(msg: NormalizedMessage) {
  let q = admin.from('ac_channels')
    .select('id, tenant_id, department, is_active').eq('type', 'whatsapp').limit(1);
  if (msg.provider_phone_id) q = q.eq('provider_phone_id', msg.provider_phone_id);
  else if (msg.to) q = q.eq('phone_number', msg.to);
  else return null;
  const { data } = await q.maybeSingle();
  if (data) {
    await admin.from('ac_channels')
      .update({ last_inbound_at: new Date().toISOString(), is_active: true })
      .eq('id', data.id);
    return data;
  }

  // Kanal existiert noch nicht → beim ersten echten Inbound automatisch anlegen
  // (kein Secret nötig, Werte stammen aus dem signaturgeprüften Provider-Payload).
  const tenantId = (await admin.from('ac_websites').select('tenant_id').limit(1).maybeSingle())
    .data?.tenant_id ?? null;
  const { data: created, error } = await admin.from('ac_channels').insert({
    tenant_id: tenantId,
    type: 'whatsapp',
    name: `WhatsApp ${msg.to ?? msg.provider_phone_id ?? msg.provider}`,
    description: 'Automatisch beim ersten eingehenden WhatsApp-Webhook angelegt',
    provider: msg.provider,
    provider_phone_id: msg.provider_phone_id ?? null,
    phone_number: msg.to ?? null,
    is_active: true,
    icon: 'message-circle',
    last_inbound_at: new Date().toISOString(),
  }).select('id, tenant_id, department, is_active').maybeSingle();
  if (error) console.error('channel autocreate failed', error.message);
  return created ?? null;
}


/** Kundenerkennung über bestehende Kundendaten — keine Kundentabelle verändern. */
async function matchCustomer(e164: string): Promise<{ customerId: string | null; ambiguous: boolean }> {
  const variants = phoneVariants(e164);
  const or = variants.map((v) => `phone.eq.${v}`).join(',');
  const { data } = await admin.from('customers').select('id').or(or).limit(5);
  if (data && data.length === 1) return { customerId: data[0].id, ambiguous: false };
  if (data && data.length > 1) return { customerId: null, ambiguous: true };

  // Fallback: AlixSmart-Registrierungsnummer (weicht oft von der Stammnummer ab)
  const smartOr = variants.map((v) => `alixsmart_phone.eq.${v}`).join(',');
  const { data: links } = await admin
    .from('alixsmart_customer_links')
    .select('alixwork_customer_id').or(smartOr).limit(5);
  if (!links || links.length === 0) return { customerId: null, ambiguous: false };
  if (links.length > 1) return { customerId: null, ambiguous: true };
  return { customerId: links[0].alixwork_customer_id, ambiguous: false };
}


async function ensureContact(msg: NormalizedMessage, tenantId: string | null, customerId: string | null) {
  const { data: existing } = await admin.from('ac_contacts')
    .select('id, customer_id').eq('whatsapp_number', msg.from).maybeSingle();
  if (existing) {
    if (customerId && !existing.customer_id) {
      await admin.from('ac_contacts').update({ customer_id: customerId }).eq('id', existing.id);
    }
    return existing.id as string;
  }
  const { data: created } = await admin.from('ac_contacts').insert({
    tenant_id: tenantId,
    whatsapp_number: msg.from,
    phone: msg.from,
    full_name: msg.contact_name,
    customer_id: customerId,
  }).select('id').single();
  return created?.id ?? null;
}

async function ensureConversation(msg: NormalizedMessage) {
  const channel = await findChannel(msg);
  const { data: existing } = await admin.from('ac_conversations')
    .select('id, tenant_id, contact_id, customer_id, unread_count')
    .eq('channel_type', 'whatsapp')
    .eq('external_thread_id', msg.from)
    .not('inbox_status', 'in', '("RESOLVED","ARCHIVED")')
    .order('last_message_at', { ascending: false })
    .limit(1).maybeSingle();
  if (existing) return { conv: existing, created: false };

  const tenantId = channel?.tenant_id
    ?? (await admin.from('ac_websites').select('tenant_id').limit(1).maybeSingle()).data?.tenant_id
    ?? null;
  const { customerId, ambiguous } = await matchCustomer(msg.from);
  const contactId = await ensureContact(msg, tenantId, customerId);

  const { data: conv } = await admin.from('ac_conversations').insert({
    tenant_id: tenantId,
    channel_id: channel?.id ?? null,
    channel_type: 'whatsapp',
    status: 'open',
    inbox_status: 'NEW',
    subject: `WhatsApp · ${msg.contact_name || msg.from}`,
    contact_id: contactId,
    customer_id: customerId,
    customer_match_required: ambiguous,
    assigned_department: channel?.department ?? null,
    external_thread_id: msg.from,
    external_meta: { from: msg.from, to: msg.to, provider: msg.provider, name: msg.contact_name },
    priority: 'P3',
    unread_count: 0,
  }).select('id, tenant_id, contact_id, customer_id, unread_count').single();

  if (conv) {
    await admin.from('ac_conversation_events').insert([
      { conversation_id: conv.id, event_type: 'CREATED', new_value: { provider: msg.provider } },
      ...(customerId ? [{ conversation_id: conv.id, event_type: 'CUSTOMER_LINKED', new_value: { customer_id: customerId } }] : []),
    ]);
  }
  return { conv, created: true };
}

async function storeMessage(msg: NormalizedMessage) {
  // Idempotenz: bereits verarbeitete Provider-Nachricht ignorieren
  const { data: dupe } = await admin.from('ac_messages')
    .select('id').eq('external_message_id', msg.provider_message_id).maybeSingle();
  if (dupe) return { skipped: true };

  const { conv } = await ensureConversation(msg);
  if (!conv) return { skipped: true };

  const { data: inserted, error } = await admin.from('ac_messages').insert({
    tenant_id: conv.tenant_id,
    conversation_id: conv.id,
    direction: DIRECTION_MAP[msg.direction],
    sender_type: 'contact',
    sender_contact_id: conv.contact_id,
    sender_name: msg.contact_name || msg.from,
    body: msg.body ? String(msg.body).slice(0, 6000) : `(${msg.message_type})`,
    attachments: msg.media.length ? msg.media : null,
    external_message_id: msg.provider_message_id,
    delivery_status: 'RECEIVED',
    metadata: { provider: msg.provider, message_type: msg.message_type, raw: msg.raw_metadata },
  }).select('id').maybeSingle();
  // Unique-Index kann bei parallelen Webhooks greifen — das ist gewollt.
  if (error && !String(error.message).includes('duplicate key')) throw error;
  if (error) return { skipped: true };

  await admin.from('ac_conversations').update({
    last_message_at: msg.timestamp,
    last_customer_message_at: msg.timestamp,
    last_message_preview: (msg.body ?? `(${msg.message_type})`).slice(0, 200),
    unread_count: (conv.unread_count ?? 0) + 1,
  }).eq('id', conv.id);

  await admin.from('ac_conversation_events').insert({
    conversation_id: conv.id,
    event_type: 'MESSAGE_RECEIVED',
    new_value: { provider_message_id: msg.provider_message_id, message_type: msg.message_type },
  });

  // Push-Benachrichtigung: darf die Speicherung niemals blockieren oder fehlschlagen lassen.
  try {
    const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-mobile-notification`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        notification_type: 'NEW_MESSAGE',
        conversation_id: conv.id,
        message_id: inserted?.id,
      }),
    });
    if (!res.ok) console.error('push dispatch failed', res.status, await res.text());
  } catch (e) {
    console.error('push dispatch error', e);
  }
  return { skipped: false };
}


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const verify = Deno.env.get('WHATSAPP_VERIFY_TOKEN') ?? '';
    if (verify && url.searchParams.get('hub.mode') === 'subscribe'
      && url.searchParams.get('hub.verify_token') === verify) {
      return new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200 });
    }
    return new Response('forbidden', { status: 403 });
  }

  try {
    const ct = req.headers.get('content-type') ?? '';
    // --- P0-1: kryptografische Provider-Verifikation über den RAW-Body ---
    const rawBody = await req.text();
    const provider = detectProvider(req, ct);
    let verification: VerifyResult;
    if (provider === 'META') {
      verification = await verifyMetaSignature(rawBody, req.headers.get('x-hub-signature-256'));
    } else if (provider === 'TWILIO') {
      const form = Object.fromEntries(new URLSearchParams(rawBody));
      verification = await verifyTwilioSignature(req.url, form, req.headers.get('x-twilio-signature'));
    } else {
      verification = { ok: false, provider: null, reason: 'UNKNOWN_PROVIDER' };
    }
    if (!verification.ok) {
      console.warn('ac-webhook-whatsapp rejected', { provider, reason: verification.reason });
      return new Response(JSON.stringify({ error: 'unauthorized', reason: verification.reason }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let payload: any;
    if (provider === 'TWILIO' || ct.includes('application/x-www-form-urlencoded')) {
      payload = Object.fromEntries(new URLSearchParams(rawBody));
    } else {
      payload = JSON.parse(rawBody);
    }


    // Zustellstatus für ausgehende Nachrichten (sent/delivered/read/failed)
    const statuses = normalizeStatuses(payload);
    let statusUpdates = 0;
    for (const st of statuses) {
      const patch: Record<string, unknown> = { delivery_status: st.status };
      if (st.status === 'delivered') patch.delivered_at = st.timestamp;
      if (st.status === 'read') patch.read_at = st.timestamp;
      if (st.status === 'sent') patch.sent_at = st.timestamp;
      if (st.status === 'failed') patch.failed_reason = st.error ?? 'provider failure';
      const { data: upd } = await admin.from('ac_messages').update(patch)
        .or(`provider_message_id.eq.${st.provider_message_id},external_message_id.eq.${st.provider_message_id}`)
        .select('id');
      statusUpdates += upd?.length ?? 0;
    }

    const messages = normalizePayload(payload);
    let stored = 0, skipped = 0;
    for (const msg of messages) {
      if (!msg.provider_message_id || !msg.from) { skipped++; continue; }
      msg.from = toE164(msg.from);
      const res = await storeMessage(msg);
      res.skipped ? skipped++ : stored++;
    }
    return new Response(JSON.stringify({ ok: true, stored, skipped, statusUpdates }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('ac-webhook-whatsapp error', e);
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
