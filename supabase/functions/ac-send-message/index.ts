import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

async function sendWhatsApp(to: string, body: string) {
  const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  const phoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  if (!token || !phoneId) throw new Error('WhatsApp secrets missing');
  const r = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } }),
  });
  if (!r.ok) throw new Error(`WhatsApp API ${r.status}: ${await r.text()}`);
  return await r.json();
}

async function sendTwilioSms(to: string, body: string) {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const auth = Deno.env.get('TWILIO_AUTH_TOKEN');
  const from = Deno.env.get('TWILIO_FROM_NUMBER');
  if (!sid || !auth || !from) throw new Error('Twilio secrets missing');
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${sid}:${auth}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
  });
  if (!r.ok) throw new Error(`Twilio API ${r.status}: ${await r.text()}`);
  return await r.json();
}

async function sendMessenger(psid: string, body: string) {
  const token = Deno.env.get('META_PAGE_ACCESS_TOKEN');
  if (!token) throw new Error('Meta Page token missing');
  const r = await fetch(`https://graph.facebook.com/v20.0/me/messages?access_token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { id: psid }, messaging_type: 'RESPONSE', message: { text: body } }),
  });
  if (!r.ok) throw new Error(`Meta API ${r.status}: ${await r.text()}`);
  return await r.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (claimsErr || !claims?.claims?.sub) return json({ error: 'Unauthorized' }, 401);
    const userId = claims.claims.sub;

    const { conversation_id, body, internal_note } = await req.json();
    if (!conversation_id || (!body && !internal_note)) return json({ error: 'invalid input' }, 400);

    const { data: conv, error: cErr } = await admin
      .from('ac_conversations')
      .select('id, tenant_id, channel_type, contact_id, visitor_meta, external_thread_id, external_meta')
      .eq('id', conversation_id).maybeSingle();
    if (cErr || !conv) return json({ error: 'conversation not found' }, 404);

    // Store outbound message immediately
    const { data: inserted, error: iErr } = await admin.from('ac_messages').insert({
      tenant_id: conv.tenant_id,
      conversation_id: conv.id,
      direction: internal_note ? 'internal' : 'outbound',
      sender_type: 'user',
      sender_user_id: userId,
      body: String(body ?? '').slice(0, 6000),
      is_internal_note: !!internal_note,
    }).select('id').single();
    if (iErr) throw iErr;

    if (internal_note) return json({ ok: true, id: inserted.id });

    // Dispatch to external channel
    let providerResult: unknown = null;
    try {
      const ct = conv.channel_type;
      if (ct === 'website_chat') {
        providerResult = { delivered_via: 'website_chat_poll' };
      } else if (ct === 'whatsapp') {
        const to = (conv.external_meta as any)?.from ?? (conv.visitor_meta as any)?.phone;
        if (!to) throw new Error('No WhatsApp recipient number');
        providerResult = await sendWhatsApp(to, body);
      } else if (ct === 'sms') {
        const to = (conv.external_meta as any)?.from ?? (conv.visitor_meta as any)?.phone;
        if (!to) throw new Error('No SMS recipient number');
        providerResult = await sendTwilioSms(to, body);
      } else if (ct === 'messenger' || ct === 'instagram') {
        const psid = (conv.external_meta as any)?.sender_id;
        if (!psid) throw new Error('No Messenger PSID');
        providerResult = await sendMessenger(psid, body);
      } else {
        providerResult = { delivered_via: 'unsupported_channel' };
      }
    } catch (dispatchErr) {
      await admin.from('ac_messages').update({
        metadata: { dispatch_error: String((dispatchErr as Error)?.message ?? dispatchErr) },
      }).eq('id', inserted.id);
      return json({ ok: false, id: inserted.id, error: String((dispatchErr as Error)?.message ?? dispatchErr) }, 502);
    }

    return json({ ok: true, id: inserted.id, provider: providerResult });
  } catch (e) {
    console.error('ac-send-message error', e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
