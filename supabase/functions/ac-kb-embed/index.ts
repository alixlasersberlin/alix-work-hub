// Embed a KB article's title+content using Lovable AI Gateway embeddings.
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
    const { article_id } = await req.json();
    if (!article_id) return new Response(JSON.stringify({ error: 'article_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: art, error } = await sb.from('ac_kb_articles').select('id,title,content').eq('id', article_id).single();
    if (error || !art) throw new Error('article not found');

    const input = `${art.title}\n\n${(art.content ?? '').slice(0, 8000)}`;
    const r = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${AI_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'openai/text-embedding-3-small', input, dimensions: 1536 }),
    });
    if (!r.ok) throw new Error(`embed ${r.status}: ${await r.text()}`);
    const j = await r.json();
    const emb = j.data?.[0]?.embedding;
    if (!emb) throw new Error('no embedding');

    const { error: upErr } = await sb.from('ac_kb_articles').update({ embedding: emb as any }).eq('id', article_id);
    if (upErr) throw upErr;
    return new Response(JSON.stringify({ ok: true, dims: emb.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
