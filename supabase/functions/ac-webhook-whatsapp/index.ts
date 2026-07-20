// WhatsApp Cloud API webhook — verification GET + inbound POST
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

async function upsertConversation(from: string, name: string | null) {
  const { data: existingConv } = await admin.from('ac_conversations')
    .select('id, tenant_id, contact_id')
    .eq('channel_type', 'whatsapp')
    .eq('external_thread_id', from)
    .in('status', ['open', 'pending'])
    .order('last_message_at', { ascending: false })
    .limit(1).maybeSingle();
  if (existingConv) return existingConv;

  const { data: site } = await admin.from('ac_websites').select('tenant_id').limit(1).maybeSingle();
  const tenant_id = site?.tenant_id ?? null;

  let contact_id: string | null = null;
  const { data: contact } = await admin.from('ac_contacts')
    .select('id').eq('whatsapp_number', from).maybeSingle();
  if (contact) contact_id = contact.id;
  else {
    const { data: newC } = await admin.from('ac_contacts')
      .insert({ tenant_id, whatsapp_number: from, phone: from, full_name: name })
      .select('id').single();
    contact_id = newC?.id ?? null;
  }

  const { data: conv } = await admin.from('ac_conversations').insert({
    tenant_id,
    channel_type: 'whatsapp',
    status: 'open',
    subject: `WhatsApp · ${name || from}`,
    contact_id,
    external_thread_id: from,
    external_meta: { from, name },
    priority: 'normal',
  }).select('id, tenant_id, contact_id').single();
  return conv;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const url = new URL(req.url);

  // Verification
  if (req.method === 'GET') {
    const verify = Deno.env.get('WHATSAPP_VERIFY_TOKEN') ?? '';
    if (url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === verify) {
      return new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200 });
    }
    return new Response('forbidden', { status: 403 });
  }

  try {
    const body = await req.json();
    const entries = body.entry ?? [];
    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        const value = change.value ?? {};
        const contacts = value.contacts ?? [];
        for (const msg of value.messages ?? []) {
          const from = msg.from;
          const name = contacts.find((c: any) => c.wa_id === from)?.profile?.name ?? null;
          const text = msg.text?.body ?? msg.button?.text ?? msg.interactive?.button_reply?.title ?? '(non-text message)';
          const conv = await upsertConversation(from, name);
          if (!conv) continue;
          await admin.from('ac_messages').insert({
            tenant_id: conv.tenant_id,
            conversation_id: conv.id,
            direction: 'inbound',
            sender_type: 'contact',
            sender_contact_id: conv.contact_id,
            sender_name: name || from,
            body: String(text).slice(0, 6000),
            external_message_id: msg.id,
            metadata: { raw: msg },
          });
        }
      }
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('ac-webhook-whatsapp error', e);
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
