// Omnichannel Orchestrator — AI picks best channel(s) + sequence per contact & context.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { contact_id, goal } = await req.json();
    if (!contact_id) throw new Error('contact_id required');

    const [{ data: contact }, { data: msgs }, { data: calls }] = await Promise.all([
      sb.from('ac_contacts').select('*').eq('id', contact_id).single(),
      sb.from('ac_messages').select('channel, direction, created_at').eq('contact_id', contact_id).order('created_at', { ascending: false }).limit(30),
      sb.from('ac_calls').select('direction, duration_sec, created_at').eq('contact_id', contact_id).order('created_at', { ascending: false }).limit(15),
    ]);
    if (!contact) throw new Error('contact not found');

    const key = Deno.env.get('LOVABLE_API_KEY')!;
    const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': key },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'Du bist Omnichannel-Orchestrator. Wähle den optimalen Kanal-Mix (whatsapp/email/sms/voice) und die Reihenfolge. Antworte NUR mit JSON: {"primary_channel":"whatsapp"|"email"|"sms"|"voice","sequence":[{"channel":string,"delay_hours":number,"message_hint":string}],"reasoning":string,"confidence":number}' },
          { role: 'user', content: `Ziel: ${goal ?? 'Kontaktaufnahme'}\nKontakt: ${JSON.stringify(contact)}\nRecent Msgs: ${JSON.stringify((msgs ?? []).slice(0, 10))}\nRecent Calls: ${JSON.stringify((calls ?? []).slice(0, 8))}` },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    if (r.status === 429) return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (r.status === 402) return new Response(JSON.stringify({ error: 'credits_exhausted' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!r.ok) throw new Error(`AI ${r.status}: ${await r.text()}`);
    const j = await r.json();
    const parsed = (() => { try { return JSON.parse(j.choices?.[0]?.message?.content || '{}'); } catch { return {}; } })();

    await sb.from('ac_predictions').insert({
      contact_id,
      kind: 'omnichannel_orchestration',
      score: Number(parsed.confidence ?? 0.5),
      risk_level: 'low',
      suggested_action: parsed.primary_channel ?? null,
      payload: { ...parsed, goal: goal ?? null, model: 'google/gemini-3-flash-preview' },
    });

    return new Response(JSON.stringify({ success: true, ...parsed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
