import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Nicht angemeldet' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: 'Nicht angemeldet' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Keine Frage übermittelt' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const [casesRes, promisesRes, tasksRes] = await Promise.all([
      admin.from('collect_cases')
        .select('customer_name, open_amount, overdue_amount, max_days_overdue, stage_code, status, risk_class, pay_probability_pct, ai_recommendation')
        .neq('status', 'closed')
        .order('overdue_amount', { ascending: false })
        .limit(120),
      admin.from('collect_promises').select('amount, promised_date, status').eq('status', 'open').limit(50),
      admin.from('collect_tasks').select('title, task_type, due_date, priority').eq('status', 'open').limit(50),
    ]);

    const cases = casesRes.data ?? [];
    const totals = cases.reduce(
      (a, c: any) => {
        a.open += Number(c.open_amount ?? 0);
        a.overdue += Number(c.overdue_amount ?? 0);
        return a;
      },
      { open: 0, overdue: 0 },
    );

    const context = {
      generated_at: new Date().toISOString(),
      totals: { open: Math.round(totals.open), overdue: Math.round(totals.overdue), case_count: cases.length },
      top_cases: cases.slice(0, 60),
      open_promises: promisesRes.data ?? [],
      open_tasks: tasksRes.data ?? [],
    };

    const systemPrompt = [
      'Du bist "Finance AI", der Forderungsmanagement-Assistent von ALIX COLLECT (AlixWork).',
      'Antworte immer auf Deutsch, sachlich, kurz und konkret, mit Zahlen und klaren Handlungsempfehlungen.',
      'Nutze ausschliesslich die bereitgestellten Daten. Wenn Daten fehlen, sage das offen.',
      'Betraege in EUR im deutschen Format. Bei Entwuerfen (E-Mail, Mahnung, Gespraechsnotiz, Ratenvereinbarung) liefere direkt verwendbaren Text.',
      '',
      'AKTUELLE DATEN (JSON):',
      JSON.stringify(context),
    ].join('\n');

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
      }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ error: 'Zu viele Anfragen, bitte kurz warten.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (aiRes.status === 402) {
      return new Response(JSON.stringify({ error: 'AI-Guthaben aufgebraucht.' }), {
        status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!aiRes.ok) {
      const text = await aiRes.text();
      console.error('AI gateway error', aiRes.status, text);
      return new Response(JSON.stringify({ error: 'KI-Dienst nicht erreichbar' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const json = await aiRes.json();
    const answer = json?.choices?.[0]?.message?.content ?? 'Keine Antwort erhalten.';

    return new Response(JSON.stringify({ answer }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('collect-copilot failed', e);
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
