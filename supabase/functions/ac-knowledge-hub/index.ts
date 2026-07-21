import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: authErr } = await supabase.auth.getClaims(token);
    if (authErr || !claims?.claims) return json({ error: 'Unauthorized' }, 401);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? 'suggest');
    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) return json({ error: 'Missing LOVABLE_API_KEY' }, 500);

    if (action === 'generate_article') {
      const { conversation_summary, question } = body;
      if (!conversation_summary && !question) return json({ error: 'input erforderlich' }, 400);
      const prompt = `Erstelle einen prägnanten Hilfe-Artikel (Deutsch) im Markdown-Format mit Feldern: title, tags (array), body_md. Basis: ${question ?? ''}\n\nKontext:\n${conversation_summary ?? ''}\n\nGib NUR JSON zurück.`;
      const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': key },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
        }),
      });
      if (!r.ok) return json({ error: 'AI error', detail: await r.text() }, r.status);
      const j = await r.json();
      const content = j.choices?.[0]?.message?.content ?? '{}';
      let article: any = {}; try { article = JSON.parse(content); } catch {}
      return json({ article });
    }

    if (action === 'suggest') {
      const { query } = body;
      if (!query) return json({ error: 'query erforderlich' }, 400);
      const { data: articles } = await supabase
        .from('ac_kb_articles')
        .select('id, title, tags, body_md, status')
        .eq('status', 'published')
        .limit(50);
      const list = (articles ?? []).map((a: any) => `- ${a.id} :: ${a.title} [${(a.tags ?? []).join(',')}]`).join('\n');
      const prompt = `User-Anfrage: "${query}"\n\nArtikel:\n${list}\n\nGib JSON: { suggestions: [{id, title, why}] }. Max 5.`;
      const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': key },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
        }),
      });
      const j = await r.json();
      let out: any = {}; try { out = JSON.parse(j.choices?.[0]?.message?.content ?? '{}'); } catch {}
      return json(out);
    }
    return json({ error: 'unknown action' }, 400);
  } catch (e: any) {
    return json({ error: e.message ?? 'error' }, 500);
  }
});

function json(v: unknown, status = 200) {
  return new Response(JSON.stringify(v), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
