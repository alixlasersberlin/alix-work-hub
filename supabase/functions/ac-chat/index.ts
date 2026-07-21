import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const FN_BASE = `${Deno.env.get('SUPABASE_URL')}/functions/v1`;
const SR_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function getWebsite(api_key: string) {
  const { data } = await supabase
    .from('ac_websites')
    .select('id, tenant_id, chat_enabled, status, welcome_message, project_name, operator, primary_color, secondary_color, logo_url, language, business_hours, widget_position, widget_config, privacy_url, imprint_url')
    .eq('api_key', api_key).maybeSingle();
  return data;
}

async function loadConversation(conversation_id: string, website_id: string) {
  const { data } = await supabase
    .from('ac_conversations').select('id, tenant_id, website_id, status, assigned_to')
    .eq('id', conversation_id).eq('website_id', website_id).maybeSingle();
  return data;
}

// Business hours check: returns { open: boolean, message?: string }
function isWithinBusinessHours(bh: any): { open: boolean; message?: string } {
  if (!bh || typeof bh !== 'object' || bh.enabled === false) return { open: true };
  try {
    const tz = bh.timezone || 'Europe/Berlin';
    const now = new Date();
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
    const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
    const dayMap: Record<string, string> = { Mon: 'mon', Tue: 'tue', Wed: 'wed', Thu: 'thu', Fri: 'fri', Sat: 'sat', Sun: 'sun' };
    const day = dayMap[parts.weekday] || 'mon';
    const hh = parseInt(parts.hour, 10);
    const mm = parseInt(parts.minute, 10);
    const cur = hh * 60 + mm;
    const cfg = bh.days?.[day];
    if (!cfg || cfg.closed) return { open: false, message: bh.closed_message };
    const [oh, om] = String(cfg.open || '09:00').split(':').map(Number);
    const [ch, cm] = String(cfg.close || '18:00').split(':').map(Number);
    const open = cur >= oh * 60 + om && cur < ch * 60 + cm;
    return { open, message: open ? undefined : bh.closed_message };
  } catch { return { open: true }; }
}

// Fire-and-forget background AI processing
async function processInboundAsync(opts: {
  site: any;
  conversation_id: string;
  tenant_id: string;
  message: string;
  is_after_hours: boolean;
}) {
  const { site, conversation_id, tenant_id, message, is_after_hours } = opts;
  try {
    // 1) Sentiment analysis
    fetch(`${FN_BASE}/ac-sentiment-emotion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SR_KEY}` },
      body: JSON.stringify({ text: message, conversation_id, channel: 'website_chat' }),
    }).then(async (r) => {
      if (!r.ok) return;
      const j = await r.json().catch(() => ({}));
      const sentiment = j?.sentiment || j?.label;
      if (sentiment) {
        await supabase.from('ac_conversations').update({ ai_sentiment: sentiment }).eq('id', conversation_id);
      }
    }).catch(() => {});

    // 2) Out-of-hours auto-reply
    if (is_after_hours) {
      const msg = site.business_hours?.closed_message ||
        'Vielen Dank für Ihre Nachricht. Wir sind aktuell außerhalb unserer Geschäftszeiten. Wir melden uns schnellstmöglich bei Ihnen.';
      await supabase.from('ac_messages').insert({
        tenant_id, conversation_id, direction: 'outbound', sender_type: 'bot',
        sender_name: site.operator || site.project_name || 'Alix Bot',
        body: msg, metadata: { auto: 'business_hours' },
      });
      await supabase.from('ac_conversations').update({ status: 'pending' }).eq('id', conversation_id);
      return;
    }

    // 3) Autonomous AI reply (opt-in via widget_config.autonomy_enabled)
    const autonomy = site.widget_config?.autonomy_enabled === true;
    if (!autonomy) return;

    // Skip if human agent is already assigned
    const { data: conv } = await supabase.from('ac_conversations')
      .select('assigned_to').eq('id', conversation_id).maybeSingle();
    if (conv?.assigned_to) return;

    const r = await fetch(`${FN_BASE}/ac-ai-reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SR_KEY}` },
      body: JSON.stringify({ message, tone: 'professional-friendly', locale: site.language || 'de' }),
    });
    if (!r.ok) return;
    const j = await r.json();
    const reply = String(j?.reply || '').trim();
    if (!reply || reply.length < 3) return;

    const confidence = reply.length > 30 && !/nicht sicher|weiß nicht|kann nicht|unable|not sure/i.test(reply) ? 0.85 : 0.3;
    const threshold = site.widget_config?.autonomy_threshold ?? 0.7;

    if (confidence >= threshold) {
      await supabase.from('ac_messages').insert({
        tenant_id, conversation_id, direction: 'outbound', sender_type: 'bot',
        sender_name: `${site.operator || 'Alix'} · AI`,
        body: reply, metadata: { auto: 'ai_autonomy', confidence },
      });
    } else {
      // Low confidence → handoff to human
      await supabase.from('ac_conversations').update({ status: 'pending', priority: 'high' }).eq('id', conversation_id);
      await supabase.from('ac_messages').insert({
        tenant_id, conversation_id, direction: 'outbound', sender_type: 'bot',
        sender_name: site.operator || 'Alix',
        body: 'Einen Moment bitte, ich verbinde Sie mit einem Mitarbeiter.',
        metadata: { auto: 'handoff', confidence },
      });
    }
  } catch (e) { console.error('processInboundAsync error', e); }
}

function scheduleBackground(p: Promise<unknown>) {
  // @ts-ignore Edge Runtime helper if present
  if (typeof EdgeRuntime !== 'undefined' && (EdgeRuntime as any).waitUntil) {
    // @ts-ignore
    EdgeRuntime.waitUntil(p);
  }
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
      const bh = isWithinBusinessHours(site.business_hours);
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
        online: bh.open,
        voice_notes_enabled: site.widget_config?.voice_notes_enabled !== false,
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
      const bh = isWithinBusinessHours(site.business_hours);
      const { data: conv, error } = await supabase.from('ac_conversations').insert({
        tenant_id: site.tenant_id,
        website_id: site.id,
        channel_type: 'website_chat',
        status: bh.open ? 'open' : 'pending',
        subject: subject ?? 'Website Chat',
        contact_id,
        priority: 'normal',
        visitor_meta: { name, email, page_url, visitor_hash, after_hours: !bh.open },
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
        scheduleBackground(processInboundAsync({
          site, conversation_id: conv.id, tenant_id: site.tenant_id,
          message: String(initial_message), is_after_hours: !bh.open,
        }));
      }
      return json({ conversation_id: conv?.id, online: bh.open });
    }

    if (action === 'send') {
      const { conversation_id, message, name, visitor_hash } = body;
      const conv = await loadConversation(conversation_id, site.id);
      if (!conv) return json({ error: 'conversation not found' }, 404);
      const bh = isWithinBusinessHours(site.business_hours);
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
      scheduleBackground(processInboundAsync({
        site, conversation_id: conv.id, tenant_id: conv.tenant_id,
        message: String(message ?? ''), is_after_hours: !bh.open,
      }));
      return json({ id: data.id, created_at: data.created_at, online: bh.open });
    }

    if (action === 'poll') {
      const { conversation_id, since } = body;
      const conv = await loadConversation(conversation_id, site.id);
      if (!conv) return json({ error: 'conversation not found' }, 404);
      let q = supabase.from('ac_messages')
        .select('id, direction, sender_name, sender_type, body, created_at')
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
