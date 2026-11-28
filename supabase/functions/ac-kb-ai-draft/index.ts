// Erzeugt KB-Artikel-Entwürfe aus kürzlich abgeschlossenen Konversationen.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { requireCallerAccess } from '../_shared/caller-access.ts';
import { generateChatCompletion, GatewayError } from 'npm:@lovable.dev/ai-gateway@0.1.15';
import type {} from '../_shared/generated/ai-gateway/models.d.ts';
import { z } from 'npm:zod@3.25.76';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    const access = await requireCallerAccess(req, corsHeaders, ['Admin', 'Super Admin']);
    if ('response' in access) return access.response;
    const parsedBody = z.object({ limit: z.number().int().min(1).max(20).default(5), days_back: z.number().int().min(1).max(365).default(7) }).strict().safeParse(await req.json().catch(() => ({})));
    if (!parsedBody.success) return json({ error: 'Invalid article draft request' }, 400);
    const { limit, days_back } = parsedBody.data;
    const sb = access.caller;

    // Kandidaten: geschlossene Konversationen mit ≥3 Messages, nicht schon als KB verwertet
    const since = new Date(Date.now() - days_back * 86400_000).toISOString();
    const { data: convos, error: conversationError } = await sb
      .from('ac_conversations')
      .select('id,tenant_id,subject,closed_at')
      .in('tenant_id', access.tenants.map(t => t.id))
      .not('closed_at', 'is', null)
      .gte('closed_at', since)
      .order('closed_at', { ascending: false })
      .limit(limit * 3);
    if (conversationError) throw conversationError;

    const drafts: any[] = [];
    for (const c of (convos ?? []).slice(0, limit)) {
      if (!access.tenants.some(t => t.id === c.tenant_id)) continue;
      const { data: msgs, error: messageError } = await sb.from('ac_messages').select('sender_type, body').eq('conversation_id', c.id).eq('tenant_id', c.tenant_id).order('created_at').limit(40);
      if (messageError) throw messageError;
      const transcript = (msgs ?? []).map((m: any) => `[${m.sender_type}] ${(m.body ?? '').slice(0, 500)}`).join('\n');
      if (transcript.length < 200) continue;

      const j = await generateChatCompletion({
          model: 'google/gemini-3-flash-preview',
          messages: [
            { role: 'system', content: 'Extrahiere aus der Konversation einen wiederverwendbaren KB-Artikel. Antworte STRIKT als JSON mit {title, category, tags:[], content}. Content in Markdown, max 500 Wörter, auf Deutsch, neutral, ohne Kundendaten/PII.' },
            { role: 'user', content: `Konversation (${c.subject ?? 'ohne Betreff'}):\n${transcript}` },
          ],
          response_format: { type: 'json_object' },
      }, { maxRetries: 0 });
      let output: unknown;
      try { output = JSON.parse(j.choices?.[0]?.message?.content ?? '{}'); } catch { continue; }
      const result = z.object({ title: z.string().trim().min(1).max(500), content: z.string().trim().min(1).max(20000), category: z.string().max(200).nullish(), tags: z.array(z.string().max(100)).max(50).default([]) }).safeParse(output);
      if (!result.success) continue;
      const parsed = result.data;

      const { data: inserted, error: insertError } = await sb.from('ac_kb_articles').insert({
        title: parsed.title,
        content: parsed.content,
        category: parsed.category ?? null,
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        status: 'review',
        public_visible: false,
        author_id: access.user.id,
        submitted_for_review_at: new Date().toISOString(),
      }).select('id, title').single();
      if (insertError) throw insertError;
      if (inserted) drafts.push(inserted);
    }

    return new Response(JSON.stringify({ ok: true, drafts }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    if (e instanceof GatewayError) return json({ error: 'gateway_error' }, e.httpStatus === 429 ? 429 : e.httpStatus === 402 ? 402 : 502);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
