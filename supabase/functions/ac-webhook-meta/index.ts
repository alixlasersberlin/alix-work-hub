// Meta Messenger / Instagram webhook (GET verify + POST inbound)
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

async function upsertConv(channel: string, psid: string, pageId: string | null) {
  const { data: existing } = await admin.from('ac_conversations')
    .select('id, tenant_id, contact_id')
    .eq('channel_type', channel).eq('external_thread_id', psid)
    .in('status', ['open', 'pending']).limit(1).maybeSingle();
  if (existing) return existing;
  const { data: site } = await admin.from('ac_websites').select('tenant_id').limit(1).maybeSingle();
  const tenant_id = site?.tenant_id ?? null;
  const { data: contact } = await admin.from('ac_contacts')
    .insert({ tenant_id, full_name: `${channel}:${psid}`, external_ids: { [channel]: psid } })
    .select('id').single();
  const { data: conv } = await admin.from('ac_conversations').insert({
    tenant_id,
    channel_type: channel,
    status: 'open',
    subject: `${channel} · ${psid}`,
    contact_id: contact?.id ?? null,
    external_thread_id: psid,
    external_meta: { sender_id: psid, page_id: pageId },
    priority: 'normal',
  }).select('id, tenant_id, contact_id').single();
  return conv;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const url = new URL(req.url);
  if (req.method === 'GET') {
    const verify = Deno.env.get('META_VERIFY_TOKEN') ?? '';
    if (url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === verify) {
      return new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200 });
    }
    return new Response('forbidden', { status: 403 });
  }
  try {
    const body = await req.json();
    const object = body.object; // 'page' or 'instagram'
    const channel = object === 'instagram' ? 'instagram' : 'messenger';
    for (const entry of body.entry ?? []) {
      const pageId = entry.id ?? null;
      for (const ev of entry.messaging ?? []) {
        const psid = ev.sender?.id;
        const text = ev.message?.text;
        if (!psid || !text || ev.message?.is_echo) continue;
        const conv = await upsertConv(channel, psid, pageId);
        if (!conv) continue;
        await admin.from('ac_messages').insert({
          tenant_id: conv.tenant_id,
          conversation_id: conv.id,
          direction: 'inbound',
          sender_type: 'contact',
          sender_contact_id: conv.contact_id,
          sender_name: psid,
          body: String(text).slice(0, 6000),
          external_message_id: ev.message?.mid,
          metadata: { raw: ev },
        });
      }
    }
    return new Response('EVENT_RECEIVED', { status: 200 });
  } catch (e) {
    console.error('ac-webhook-meta error', e);
    return new Response('EVENT_RECEIVED', { status: 200 });
  }
});
