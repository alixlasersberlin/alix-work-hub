// Summarizes a meeting transcript into a concise summary + action items and stores on ac_meetings.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const AI_KEY = Deno.env.get('LOVABLE_API_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { meeting_id, transcript: overrideTranscript } = await req.json();
    if (!meeting_id) return new Response(JSON.stringify({ error: 'meeting_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: m, error } = await sb.from('ac_meetings').select('id, transcript').eq('id', meeting_id).single();
    if (error || !m) throw new Error(error?.message || 'meeting not found');
    const transcript: string = overrideTranscript || m.transcript || '';
    if (!transcript.trim()) throw new Error('no transcript to summarize');

    const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${AI_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'Erstelle eine strukturierte Meeting-Zusammenfassung. Antworte NUR mit gültigem JSON: {"summary":string (max 400 Wörter, in Deutsch),"action_items":string[]}' },
          { role: 'user', content: transcript.slice(0, 20000) },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    if (!r.ok) throw new Error(`AI ${r.status}: ${await r.text()}`);
    const j = await r.json();
    const parsed = (() => { try { return JSON.parse(j.choices?.[0]?.message?.content || '{}'); } catch { return {}; } })();

    await sb.from('ac_meetings').update({
      transcript,
      ai_summary: parsed.summary || null,
      action_items: Array.isArray(parsed.action_items) ? parsed.action_items : [],
    }).eq('id', meeting_id);

    return new Response(JSON.stringify({ ok: true, ...parsed }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
