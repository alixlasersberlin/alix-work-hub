// Click-to-Call - initiates a call via 3CX Call Control API
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: auth } } }
    );
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { to, contact_id, conversation_id } = await req.json();
    if (!to) return new Response(JSON.stringify({ error: 'missing to' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Prefer user-specific settings, fallback to global (user_id null)
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: settings } = await admin
      .from('ac_pbx_settings')
      .select('*')
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .eq('enabled', true)
      .order('user_id', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    let externalId: string | null = null;
    if (settings?.pbx_url && settings?.api_token && settings?.extension) {
      try {
        const resp = await fetch(`${settings.pbx_url.replace(/\/$/, '')}/callcontrol/${encodeURIComponent(settings.extension)}/makecall`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.api_token}` },
          body: JSON.stringify({ destination: to }),
        });
        const j = await resp.json().catch(() => ({}));
        externalId = j?.call_id || j?.result?.callid || null;
      } catch (err) {
        console.warn('PBX call failed, logging only', err);
      }
    }

    const { data: call } = await admin.from('ac_calls').insert({
      direction: 'outbound',
      status: 'ringing',
      from_number: settings?.extension ?? null,
      to_number: to,
      extension: settings?.extension ?? null,
      agent_user_id: user.id,
      contact_id: contact_id ?? null,
      conversation_id: conversation_id ?? null,
      external_call_id: externalId ?? `manual-${user.id}-${Date.now()}`,
      metadata: { initiated_via: 'click-to-call' },
    }).select().single();

    return new Response(JSON.stringify({ ok: true, call, tel_uri: `tel:${to}` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('ac-3cx-call error', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
