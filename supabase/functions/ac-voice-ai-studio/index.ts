// Voice AI Studio — generate outbound voice scripts, sentiment-adaptive branches, voicemail drops.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { campaign_name, objective, tone = 'professionell', contact_id } = await req.json();
    if (!objective) throw new Error('objective required');

    let ctx: any = null;
    if (contact_id) {
      const { data } = await sb.from('ac_contacts').select('full_name, email, phone, tags').eq('id', contact_id).maybeSingle();
      ctx = data;
    }

    const key = Deno.env.get('LOVABLE_API_KEY')!;
    const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': key },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'Du bist Voice-AI-Script-Designer. Erstelle Outbound-Anruf-Skript mit dynamischen Verzweigungen. Antworte NUR mit JSON: {"opening":string,"discovery_questions":[string],"objection_handling":[{"objection":string,"response":string}],"positive_close":string,"neutral_close":string,"negative_close":string,"voicemail_drop":string,"estimated_duration_sec":number}' },
          { role: 'user', content: `Kampagne: ${campaign_name ?? '(unbenannt)'}\nZiel: ${objective}\nTonalität: ${tone}\nKontext: ${ctx ? JSON.stringify(ctx) : 'generisch'}` },
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
      contact_id: contact_id ?? null,
      kind: 'voice_ai_script',
      score: 1,
      risk_level: 'low',
      suggested_action: campaign_name ?? objective,
      payload: { ...parsed, campaign_name, objective, tone, model: 'google/gemini-3-flash-preview' },
    });

    return new Response(JSON.stringify({ success: true, ...parsed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
