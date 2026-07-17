import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    const userId = userData?.user?.id;
    if (!userId) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders });

    const { document_id, text_content } = await req.json();
    if (!document_id) {
      return new Response(JSON.stringify({ error: 'document_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // If text not provided, try to load metadata (real PDF extraction happens client-side)
    let content = text_content ?? '';
    if (!content) {
      const { data: doc } = await supabase.from('sig_documents').select('title, description').eq('id', document_id).single();
      content = `${doc?.title ?? ''}\n${doc?.description ?? ''}`;
    }
    if (content.length > 15000) content = content.slice(0, 15000);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY missing' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const systemPrompt = `Du bist ein juristischer Vertragsanalyst für deutsches Recht (BGB, DSGVO). Analysiere den Vertrag und antworte NUR mit gültigem JSON in diesem Schema:
{
  "risk_score": 0-100,
  "summary": "kurze Zusammenfassung in Deutsch (max 3 Sätze)",
  "clauses": [{"type": "Haftung|Kündigung|Zahlung|Datenschutz|AGB", "risk": "low|medium|high", "quote": "kurzer Zitat", "suggestion": "Verbesserungsvorschlag"}],
  "suggested_fields": [{"type": "signature|date|text|checkbox", "page": 1, "label": "Feldname", "x": 0.5, "y": 0.9, "w": 0.2, "h": 0.05}]
}
Koordinaten x,y,w,h relativ 0-1. Max 5 clauses, max 4 suggested_fields.`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Vertragstext:\n${content}` },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return new Response(JSON.stringify({ error: 'ai_gateway_failed', details: errText, status: aiRes.status }),
        { status: aiRes.status === 402 || aiRes.status === 429 ? aiRes.status : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const aiData = await aiRes.json();
    const raw = aiData.choices?.[0]?.message?.content ?? '{}';
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { parsed = { summary: raw, risk_score: 0, clauses: [], suggested_fields: [] }; }

    const { data: analysis, error } = await supabase.from('sig_ai_analyses').insert({
      document_id,
      risk_score: parsed.risk_score ?? null,
      summary: parsed.summary ?? null,
      clauses: parsed.clauses ?? [],
      suggested_fields: parsed.suggested_fields ?? [],
      model: 'google/gemini-3-flash-preview',
      tokens_used: aiData.usage?.total_tokens ?? null,
      created_by: userId,
    }).select().single();

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
