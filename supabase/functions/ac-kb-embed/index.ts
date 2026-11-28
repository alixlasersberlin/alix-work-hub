import { requireCallerAccess } from '../_shared/caller-access.ts';
import { z } from 'npm:zod@3.25.76';
// Embed a KB article's title+content using Lovable AI Gateway embeddings.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const AI_KEY = Deno.env.get('LOVABLE_API_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    const access = await requireCallerAccess(req, corsHeaders, ['Admin', 'Super Admin']);
    if ('response' in access) return access.response;
    const sb = access.caller;
    const parsedBody = z.object({ article_id: z.string().uuid() }).strict().safeParse(await req.json().catch(() => null));
    if (!parsedBody.success) return new Response(JSON.stringify({ error: 'Invalid article_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const { article_id } = parsedBody.data;
    if (!article_id) return new Response(JSON.stringify({ error: 'article_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const { data: art, error } = await sb.from('ac_kb_articles').select('id,title,content').eq('id', article_id).single();
    if (error || !art) return new Response(JSON.stringify({ error: 'Article not found in authorized scope' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

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
