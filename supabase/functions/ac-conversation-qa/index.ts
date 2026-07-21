// ALIX CONNECT Phase 47 — Conversation QA & Auto-Coaching
// Analysiert geschlossene Conversations (ac_conversations) via Gemini,
// vergibt Score-Card (Begrüßung, Empathie, Lösung, Compliance, Ton) und
// speichert Ergebnisse in public.ac_conversation_qa.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AI_KEY = Deno.env.get('LOVABLE_API_KEY')!;
const MODEL = 'google/gemini-3-flash-preview';

const SYSTEM = `Du bist QA-Auditor für Kundenservice-Conversations. Bewerte objektiv nach 5 Dimensionen (jeweils 0–100):
- greeting: Begrüßung, Vorstellung, Ansprache
- empathy: Empathie, Verständnis, aktives Zuhören
- resolution: Problemlösung, Vollständigkeit, Korrektheit
- compliance: Datenschutz, keine Zusagen ohne Deckung, keine sensitive Daten
- tone: Professionalität, Freundlichkeit, Grammatik
Antworte NUR mit JSON:
{"overall":number,"greeting":number,"empathy":number,"resolution":number,"compliance":number,"tone":number,"strengths":[string,string,string],"improvements":[string,string,string],"summary":string}`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body = await req.json().catch(() => ({}));
    const { conversation_id, batch_limit = 20, since_hours = 48 } = body ?? {};

    // Ziel-Conversations laden
    let convs: any[] = [];
    if (conversation_id) {
      const { data } = await sb.from('ac_conversations')
        .select('id, status, subject, assigned_user_id, created_at, closed_at')
        .eq('id', conversation_id).limit(1);
      convs = data ?? [];
    } else {
      const sinceIso = new Date(Date.now() - since_hours * 3600_000).toISOString();
      const { data: existing } = await sb.from('ac_conversation_qa').select('conversation_id');
      const seen = new Set((existing ?? []).map((r: any) => r.conversation_id));
      const { data } = await sb.from('ac_conversations')
        .select('id, status, subject, assigned_user_id, created_at, closed_at')
        .in('status', ['closed', 'resolved'])
        .gte('updated_at', sinceIso)
        .order('updated_at', { ascending: false })
        .limit(batch_limit * 3);
      convs = (data ?? []).filter((c: any) => !seen.has(c.id)).slice(0, batch_limit);
    }

    const results: any[] = [];
    for (const conv of convs) {
      const { data: msgs } = await sb.from('ac_messages')
        .select('direction, sender_type, sender_name, body, created_at, is_internal_note')
        .eq('conversation_id', conv.id)
        .eq('is_internal_note', false)
        .order('created_at', { ascending: true })
        .limit(200);
      if (!msgs || msgs.length < 2) continue;

      // First response + Resolution
      const firstIn = msgs.find((m: any) => m.direction === 'inbound');
      const firstOut = msgs.find((m: any) => m.direction === 'outbound' && firstIn && new Date(m.created_at) > new Date(firstIn.created_at));
      const firstRespSec = firstIn && firstOut ? Math.round((+new Date(firstOut.created_at) - +new Date(firstIn.created_at)) / 1000) : null;
      const resolutionSec = conv.closed_at && conv.created_at
        ? Math.round((+new Date(conv.closed_at) - +new Date(conv.created_at)) / 1000) : null;

      const transcript = msgs.map((m: any) =>
        `[${m.direction === 'inbound' ? 'KUNDE' : 'AGENT'} ${new Date(m.created_at).toISOString()}] ${m.sender_name ?? ''}: ${(m.body ?? '').slice(0, 1500)}`
      ).join('\n').slice(0, 12000);

      const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AI_KEY}` },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: `Betreff: ${conv.subject ?? '(kein Betreff)'}\nErsteantwort-Sek: ${firstRespSec ?? 'n/a'}\nLösung-Sek: ${resolutionSec ?? 'n/a'}\n\nVERLAUF:\n${transcript}` },
          ],
          response_format: { type: 'json_object' },
        }),
      });
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: 'credits_exhausted' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (!aiRes.ok) { console.error('AI', await aiRes.text()); continue; }
      const j = await aiRes.json();
      let p: any = {};
      try { p = JSON.parse(j.choices?.[0]?.message?.content || '{}'); } catch { continue; }

      const row = {
        conversation_id: conv.id,
        agent_user_id: conv.assigned_user_id ?? null,
        overall_score: Number(p.overall ?? 0),
        greeting_score: p.greeting != null ? Number(p.greeting) : null,
        empathy_score: p.empathy != null ? Number(p.empathy) : null,
        resolution_score: p.resolution != null ? Number(p.resolution) : null,
        compliance_score: p.compliance != null ? Number(p.compliance) : null,
        tone_score: p.tone != null ? Number(p.tone) : null,
        first_response_seconds: firstRespSec,
        resolution_seconds: resolutionSec,
        strengths: Array.isArray(p.strengths) ? p.strengths : [],
        improvements: Array.isArray(p.improvements) ? p.improvements : [],
        summary: typeof p.summary === 'string' ? p.summary : null,
        model: MODEL,
      };
      const { error } = await sb.from('ac_conversation_qa').upsert(row, { onConflict: 'conversation_id' });
      if (error) console.error('upsert', error);
      else results.push({ conversation_id: conv.id, overall: row.overall_score });
    }

    return new Response(JSON.stringify({ ok: true, evaluated: results.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
