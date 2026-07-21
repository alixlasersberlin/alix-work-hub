import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Phase 40 — AI Voice Agent Studio: prompt-testing sandbox powered by Lovable AI Gateway.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return j({ error: 'Unauthorized' }, 401);
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error } = await supabase.auth.getClaims(token);
    if (error || !claims?.claims) return j({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? 'templates');

    const TEMPLATES = [
      { id: 'reception', name: 'Empfang', language: 'de', prompt: 'Du bist die freundliche Empfangs-KI von Alix. Nimm Anrufe entgegen, ermittle das Anliegen und leite an die richtige Abteilung weiter.' },
      { id: 'appointment', name: 'Terminvereinbarung', language: 'de', prompt: 'Du vereinbarst Termine. Erfrage Wunschzeit, Anliegen und Kontaktdaten und bestätige den Termin am Ende.' },
      { id: 'support-l1', name: 'Support L1', language: 'de', prompt: 'Du bist Support-Level-1. Höre zu, stelle klärende Fragen, biete Standardlösungen an und eskaliere bei Bedarf.' },
      { id: 'sales-qualify', name: 'Sales-Qualifizierung', language: 'de', prompt: 'Du qualifizierst neue Leads. Erfrage Bedarf, Budget, Zeitrahmen und Entscheider (BANT).' },
      { id: 'outbound-en', name: 'Outbound (EN)', language: 'en', prompt: 'You are a professional outbound assistant. Introduce Alix, verify interest, book a follow-up.' },
    ];

    if (action === 'templates') return j({ templates: TEMPLATES });

    if (action === 'test') {
      const apiKey = Deno.env.get('LOVABLE_API_KEY');
      if (!apiKey) return j({ error: 'LOVABLE_API_KEY missing' }, 500);
      const system = String(body.system ?? TEMPLATES[0].prompt);
      const user = String(body.user ?? 'Hallo.');
      const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': apiKey },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        }),
      });
      if (!res.ok) return j({ error: 'gateway_error', status: res.status, detail: await res.text() }, res.status);
      const data = await res.json();
      return j({ reply: data?.choices?.[0]?.message?.content ?? '', usage: data?.usage ?? null });
    }

    return j({ error: 'unknown action' }, 400);
  } catch (e: any) {
    return j({ error: e.message ?? 'error' }, 500);
  }
});
function j(v: unknown, status = 200) {
  return new Response(JSON.stringify(v), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
