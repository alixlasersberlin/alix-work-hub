import { requireCallerAccess } from '../_shared/caller-access.ts';
import { callScopeAllowed } from '../_shared/call-scope.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3.25.76';
// Conversational Intelligence 2.0 — deep speech analytics for one call.
// Computes talk/listen ratio, silence share, topic detection, and DSGVO/recording
// compliance checks. Persists into ac_voice_insights.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    const access = await requireCallerAccess(req, corsHeaders, ['Admin', 'Super Admin']);
    if ('response' in access) return access.response;
    const sb = access.caller;
    const parsedBody = z.object({ call_id: z.string().uuid() }).strict().safeParse(await req.json().catch(() => null));
    if (!parsedBody.success) return new Response(JSON.stringify({ error: 'Invalid call_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const { call_id } = parsedBody.data;
    if (!call_id) throw new Error('call_id required');

    const { data: call, error: callErr } = await sb.from('ac_calls')
      .select('id, contact_id, transcript, duration_sec, agent_user_id, direction').eq('id', call_id).single();
    if (callErr || !call || !await callScopeAllowed(access, call)) return new Response(JSON.stringify({ error: 'Call not found in authorized scope' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!call.transcript) throw new Error('call has no transcript — run STT first');

    const { data: rules } = await sb.from('ac_voice_compliance_rules').select('*').eq('active', true);

    const rubric = (rules ?? []).map((r: any) => `- ${r.rule_key}: ${r.description ?? r.pattern ?? ''}`).join('\n')
      || '- dsgvo_notice: Erwähnung von Datenschutz/DSGVO\n- recording_disclaimer: Ansage, dass das Gespräch aufgezeichnet wird';

    const key = Deno.env.get('LOVABLE_API_KEY')!;
    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': key },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: `Du analysierst Kundenservice-Gespräche. Antworte NUR mit JSON:\n{"topics":[string],"talk_ratio_agent":number(0-1),"silence_share":number(0-1),"compliance":{"<rule_key>":boolean},"summary":string,"risk_flags":[string]}\n\nCompliance-Regeln:\n${rubric}` },
          { role: 'user', content: (call.transcript as string).slice(0, 18000) },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    if (!aiRes.ok) throw new Error(`AI ${aiRes.status}: ${await aiRes.text()}`);
    const j = await aiRes.json();
    const parsed = (() => { try { return JSON.parse(j.choices?.[0]?.message?.content || '{}'); } catch { return {}; } })();

    const talkAgent = Number(parsed.talk_ratio_agent ?? 0.5);
    const insight = {
      call_id,
      agent_user_id: call.agent_user_id ?? null,
      topics: parsed.topics ?? [],
      talk_ratio_agent: talkAgent,
      talk_ratio_customer: Math.max(0, 1 - talkAgent),
      silence_share: Number(parsed.silence_share ?? 0),
      compliance: parsed.compliance ?? {},
      summary: parsed.summary ?? null,
      risk_flags: parsed.risk_flags ?? [],
      ai_generated: true,
    };

    const writer = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: row, error } = await writer.from('ac_voice_insights').insert(insight).select().single();
    if (error) throw error;

    return new Response(JSON.stringify({ success: true, insight: row }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
