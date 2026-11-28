// Knowledge Graph & RAG 2.0 — semantic search over conversations, tickets, docs with cited answers.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { requireCallerAccess } from '../_shared/caller-access.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  const access = await requireCallerAccess(req, corsHeaders);
  if ('response' in access) return access.response;
  const { data: staff, error: staffError } = await access.caller.rpc('is_internal_staff');
  if (staffError || staff !== true) return new Response('Internal search permission required', { status: 403, headers: corsHeaders });
  try {
    const sb = access.caller;
    const { query, contact_id } = await req.json();
    if (typeof query !== 'string' || query.length < 1 || query.length > 1000) return new Response('Invalid query', { status: 400, headers: corsHeaders });
    // No current UI uses optional prediction persistence; isolate until its narrow write policy is verified.
    if (contact_id) return new Response('Prediction persistence not authorized', { status: 403, headers: corsHeaders });

    // Gather candidate sources (lightweight retrieval; embeddings pipeline TBD).
    const like = `%${query.slice(0, 80).replace(/[%_(),.\\]/g, ' ')}%`;
    const tenantIds = access.tenants.map((t: any) => t.id);
    const results = await Promise.all([
      sb.from('ac_messages').select('id, body, channel, created_at, contact_id').in('tenant_id', tenantIds).ilike('body', like).order('created_at', { ascending: false }).limit(15),
      sb.from('tickets').select('id, subject, description, status, created_at').or(`subject.ilike.${like},description.ilike.${like}`).order('created_at', { ascending: false }).limit(10),
      sb.from('alixdocs_documents').select('id, title, summary, doc_type, created_at').in('tenant_id', tenantIds).or(`title.ilike.${like},summary.ilike.${like}`).eq('is_deleted', false).order('created_at', { ascending: false }).limit(10),
    ]);
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
    const [{ data: msgs }, { data: tickets }, { data: docs }] = results;

    const sources = [
      ...(msgs ?? []).map((m) => ({ kind: 'message', id: m.id, snippet: (m.body ?? '').slice(0, 400), ref: `msg:${m.id}` })),
      ...(tickets ?? []).map((t) => ({ kind: 'ticket', id: t.id, snippet: `${t.subject ?? ''} — ${(t.description ?? '').slice(0, 300)}`, ref: `ticket:${t.id}` })),
      ...(docs ?? []).map((d) => ({ kind: 'document', id: d.id, snippet: `${d.title ?? ''} — ${(d.summary ?? '').slice(0, 300)}`, ref: `doc:${d.id}` })),
    ].slice(0, 25);

    const key = Deno.env.get('LOVABLE_API_KEY')!;
    const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': key },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'Du bist RAG-Assistant für ein Enterprise Knowledge Graph. Beantworte die Frage NUR auf Basis der bereitgestellten sources. Zitiere jede Aussage mit [ref:...]. Antworte NUR mit JSON: {"answer":string,"citations":[{"ref":string,"quote":string}],"related_entities":[string],"confidence":number,"missing_info":string|null}' },
          { role: 'user', content: `Frage: ${query}\nSources: ${JSON.stringify(sources)}` },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    if (r.status === 429) return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (r.status === 402) return new Response(JSON.stringify({ error: 'credits_exhausted' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!r.ok) throw new Error(`AI ${r.status}: ${await r.text()}`);
    const j = await r.json();
    const p = (() => { try { return JSON.parse(j.choices?.[0]?.message?.content || '{}'); } catch { return {}; } })();

    if (contact_id) {
      await sb.from('ac_predictions').insert({
        contact_id,
        kind: 'knowledge_rag_query',
        score: Number(p.confidence ?? 0.5),
        risk_level: 'low',
        suggested_action: (p.answer ?? '').slice(0, 200),
        payload: { query, ...p, source_count: sources.length, model: 'google/gemini-3-flash-preview' },
      });
    }

    return new Response(JSON.stringify({ success: true, ...p, source_count: sources.length, sources }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
