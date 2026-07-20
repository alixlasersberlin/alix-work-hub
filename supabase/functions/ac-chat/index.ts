import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

async function getWebsite(api_key: string) {
  const { data } = await supabase
    .from('ac_websites')
    .select('id, tenant_id, chat_enabled, status, welcome_message, project_name, operator, primary_color, secondary_color, logo_url, language, business_hours, widget_position, widget_config, privacy_url, imprint_url')
    .eq('api_key', api_key).maybeSingle();
  return data;
}

async function loadConversation(conversation_id: string, website_id: string) {
  const { data } = await supabase
    .from('ac_conversations').select('id, tenant_id, website_id, status')
    .eq('id', conversation_id).eq('website_id', website_id).maybeSingle();
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const url = new URL(req.url);
  const action = url.searchParams.get('action') ?? '';
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    if (req.method === 'GET' && action === 'config') {
      const api_key = url.searchParams.get('api_key') ?? '';
      const site = await getWebsite(api_key);
      if (!site || site.status !== 'active') return json({ error: 'not found' }, 404);
      return json({
        chat_enabled: site.chat_enabled,
        welcome_message: site.welcome_message,
        project_name: site.project_name,
        operator: site.operator,
        primary_color: site.primary_color,
        secondary_color: site.secondary_color,
        logo_url: site.logo_url,
        language: site.language,
        business_hours: site.business_hours,
        widget_position: site.widget_position,
        widget_config: site.widget_config,
        privacy_url: site.privacy_url,
        imprint_url: site.imprint_url,
      });
    }

    const body = await req.json().catch(() => ({}));
    const { api_key } = body ?? {};
    const site = await getWebsite(api_key);
    if (!site || site.status !== 'active' || !site.chat_enabled) return json({ error: 'chat disabled' }, 404);

    if (action === 'start') {
      const { name, email, subject, initial_message, page_url, visitor_hash } = body;
      let contact_id: string | null = null;
      if (email) {
        const { data: existing } = await supabase.from('ac_contacts')
          .select('id').eq('tenant_id', site.tenant_id).eq('email', email).maybeSingle();
        if (existing) contact_id = existing.id;
        else {
          const { data: newC } = await supabase.from('ac_contacts').insert({
            tenant_id: site.tenant_id, email, full_name: name ?? null,
            visitor_fingerprint: visitor_hash ?? null,
          }).select('id').single();
          contact_id = newC?.id ?? null;
        }
      }
      const { data: conv, error } = await supabase.from('ac_conversations').insert({
        tenant_id: site.tenant_id,
        website_id: site.id,
        channel_type: 'website_chat',
        status: 'open',
        subject: subject ?? 'Website Chat',
        contact_id,
        priority: 'normal',
        visitor_meta: { name, email, page_url, visitor_hash },
        last_message_preview: initial_message ?? null,
      }).select('id').single();
      if (error) throw error;

      if (initial_message && conv?.id) {
        await supabase.from('ac_messages').insert({
          tenant_id: site.tenant_id,
          conversation_id: conv.id,
          direction: 'inbound',
          sender_type: 'contact',
          sender_contact_id: contact_id,
          sender_name: name ?? 'Website Besucher',
          body: String(initial_message).slice(0, 4000),
        });
      }
      return json({ conversation_id: conv?.id });
    }

    if (action === 'send') {
      const { conversation_id, message, name, visitor_hash } = body;
      const conv = await loadConversation(conversation_id, site.id);
      if (!conv) return json({ error: 'conversation not found' }, 404);
      const { data, error } = await supabase.from('ac_messages').insert({
        tenant_id: conv.tenant_id,
        conversation_id: conv.id,
        direction: 'inbound',
        sender_type: 'contact',
        sender_name: name ?? 'Website Besucher',
        body: String(message ?? '').slice(0, 4000),
        metadata: { visitor_hash },
      }).select('id, created_at').single();
      if (error) throw error;
      return json({ id: data.id, created_at: data.created_at });
    }

    if (action === 'poll') {
      const { conversation_id, since } = body;
      const conv = await loadConversation(conversation_id, site.id);
      if (!conv) return json({ error: 'conversation not found' }, 404);
      let q = supabase.from('ac_messages')
        .select('id, direction, sender_name, body, created_at')
        .eq('conversation_id', conv.id)
        .eq('is_internal_note', false)
        .order('created_at', { ascending: true }).limit(100);
      if (since) q = q.gt('created_at', since);
      const { data, error } = await q;
      if (error) throw error;
      return json({ messages: data ?? [] });
    }

    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    console.error('ac-chat error', e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
