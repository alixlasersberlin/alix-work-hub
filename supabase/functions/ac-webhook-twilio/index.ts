// Twilio SMS inbound webhook (application/x-www-form-urlencoded)
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const form = await req.formData();
    const from = String(form.get('From') ?? '');
    const bodyText = String(form.get('Body') ?? '');
    const smsSid = String(form.get('MessageSid') ?? form.get('SmsMessageSid') ?? '');
    if (!from) return new Response('<Response/>', { headers: { 'Content-Type': 'application/xml' } });

    const { data: existing } = await admin.from('ac_conversations')
      .select('id, tenant_id, contact_id')
      .eq('channel_type', 'sms')
      .eq('external_thread_id', from)
      .in('status', ['open', 'pending'])
      .limit(1).maybeSingle();

    let conv = existing;
    if (!conv) {
      const { data: site } = await admin.from('ac_websites').select('tenant_id').limit(1).maybeSingle();
      const tenant_id = site?.tenant_id ?? null;
      const { data: contact } = await admin.from('ac_contacts')
        .upsert({ tenant_id, phone: from, full_name: from }, { onConflict: 'phone' })
        .select('id').single();
      const { data: newConv } = await admin.from('ac_conversations').insert({
        tenant_id,
        channel_type: 'sms',
        status: 'open',
        subject: `SMS · ${from}`,
        contact_id: contact?.id ?? null,
        external_thread_id: from,
        external_meta: { from },
        priority: 'normal',
      }).select('id, tenant_id, contact_id').single();
      conv = newConv;
    }

    if (conv) {
      await admin.from('ac_messages').insert({
        tenant_id: conv.tenant_id,
        conversation_id: conv.id,
        direction: 'inbound',
        sender_type: 'contact',
        sender_contact_id: conv.contact_id,
        sender_name: from,
        body: bodyText.slice(0, 6000),
        external_message_id: smsSid,
      });
    }

    return new Response('<Response/>', { status: 200, headers: { 'Content-Type': 'application/xml' } });
  } catch (e) {
    console.error('ac-webhook-twilio error', e);
    return new Response('<Response/>', { status: 200, headers: { 'Content-Type': 'application/xml' } });
  }
});
