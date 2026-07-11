import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface Body {
  title?: string;
  kind?: string;
  duration_minutes?: number;
  department_id?: string;
  customer_name?: string;
  address?: string;
  preferred_from?: string; // ISO
  preferred_to?: string;   // ISO
}

function daysAhead(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY missing');
    const body: Body = await req.json();
    const duration = Math.max(15, Math.min(480, body.duration_minutes ?? 60));

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const from = body.preferred_from || new Date().toISOString();
    const to = body.preferred_to || daysAhead(14);

    // gather context
    const [{ data: employees }, { data: events }, { data: depts }, { data: resources }] = await Promise.all([
      supabase.from('esc_employee_settings').select('user_id, display_name, working_hours, skills').limit(50),
      supabase.from('esc_events').select('id, start_at, end_at, assigned_user_id, department_id, address, location').gte('start_at', from).lte('start_at', to).limit(500),
      supabase.from('esc_departments').select('id, name').limit(50),
      supabase.from('esc_resources').select('id, name, type').limit(50),
    ]);

    const prompt = `Du bist ein KI-Terminplaner. Schlage 3 optimale Termin-Slots vor.

Anfrage:
- Titel: ${body.title || '(kein)'}
- Art: ${body.kind || '(unbekannt)'}
- Dauer: ${duration} Minuten
- Abteilung: ${body.department_id || '(egal)'}
- Kunde: ${body.customer_name || '(kein)'}
- Adresse: ${body.address || '(keine)'}
- Bevorzugter Zeitraum: ${from} bis ${to}

Verfügbare Mitarbeiter (${employees?.length ?? 0}):
${JSON.stringify(employees ?? [], null, 0).slice(0, 4000)}

Bereits geplante Termine im Zeitraum:
${JSON.stringify((events ?? []).map(e => ({ s: e.start_at, e: e.end_at, u: e.assigned_user_id, adr: e.address, loc: e.location })), null, 0).slice(0, 6000)}

Ressourcen: ${JSON.stringify(resources ?? []).slice(0, 1500)}

Antworte NUR mit JSON in folgender Struktur:
{"suggestions":[{"start_at":"ISO","end_at":"ISO","employee_id":"uuid|null","employee_name":"...","reason":"kurze Begründung auf Deutsch","score":0-100}]}`;

    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'Du planst Termine effizient. Berücksichtige Arbeitszeiten, Region-Clustering (Anfahrten minimieren), Konflikte und Skills. Antworte ausschließlich mit gültigem JSON.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      return new Response(JSON.stringify({ error: 'AI gateway failed', status: aiResp.status, details: errText }), {
        status: aiResp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResp.json();
    const content = aiData.choices?.[0]?.message?.content ?? '{}';
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = { suggestions: [], raw: content }; }

    // enrich employee_name if missing
    const empMap = new Map((employees ?? []).map((e: any) => [e.user_id, e.display_name]));
    parsed.suggestions = (parsed.suggestions || []).map((s: any) => ({
      ...s,
      employee_name: s.employee_name || (s.employee_id ? empMap.get(s.employee_id) : null) || 'unzugewiesen',
    }));

    // audit log
    try {
      await supabase.from('esc_audit_log').insert({
        entity_type: 'ai_suggest',
        entity_id: null,
        action: 'AI_SUGGEST',
        new_data: { request: body, suggestions: parsed.suggestions },
      });
    } catch { /* ignore */ }

    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('esc-ai-suggest error', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
