// Summarizes a meeting transcript into a concise summary + action items and stores on ac_meetings.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { activeMessageAccount } from '../_shared/message-access.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const AI_KEY = Deno.env.get('LOVABLE_API_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const caller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: identity, error: authError } = await caller.auth.getUser();
    if (authError || !identity?.user) return new Response(JSON.stringify({ error: 'Nicht angemeldet' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const { meeting_id, transcript: overrideTranscript } = await req.json();
    if (!meeting_id) return new Response(JSON.stringify({ error: 'meeting_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: profile } = await sb.from('user_profiles').select('is_active,account_status,invitation_status,password_reset_required').eq('id', identity.user.id).maybeSingle();
    if (!activeMessageAccount(profile)) return new Response(JSON.stringify({ error: 'Benutzer nicht freigegeben' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: m, error } = await caller.from('ac_meetings').select('id, transcript, host_user_id').eq('id', meeting_id).single();
    if (error || !m) throw new Error(error?.message || 'meeting not found');
    const [adminRole, superRole] = await Promise.all(['Admin', 'Super Admin'].map(check_role => caller.rpc('has_role', { check_role })));
    if (m.host_user_id !== identity.user.id && !(adminRole.data === true && !adminRole.error) && !(superRole.data === true && !superRole.error)) return new Response(JSON.stringify({ error: 'Keine Bearbeitungsberechtigung für dieses Meeting' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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

    const { data: updated, error: updateError } = await caller.from('ac_meetings').update({
      transcript,
      ai_summary: parsed.summary || null,
      action_items: Array.isArray(parsed.action_items) ? parsed.action_items : [],
    }).eq('id', meeting_id).select('id');
    if (updateError || !updated?.length) throw new Error('Meeting konnte nicht gespeichert werden');

    return new Response(JSON.stringify({ ok: true, ...parsed }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
