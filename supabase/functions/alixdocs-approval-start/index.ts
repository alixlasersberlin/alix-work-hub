import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (s: number, b: unknown) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const auth = req.headers.get('Authorization') ?? '';
    if (!auth) return json(401, { error: 'unauthorized' });

    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const asUser = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: userRes } = await asUser.auth.getUser();
    const user = userRes?.user;
    if (!user) return json(401, { error: 'unauthorized' });

    const body = await req.json().catch(() => ({}));
    const { document_id, chain_id } = body as { document_id?: string; chain_id?: string };
    if (!document_id) return json(400, { error: 'document_id required' });

    const svc = createClient(url, service);

    // Resolve chain: explicit or category-default
    let chain: any = null;
    if (chain_id) {
      const { data } = await svc.from('alixdocs_approval_chains').select('*').eq('id', chain_id).eq('active', true).maybeSingle();
      chain = data;
    } else {
      const { data: doc } = await svc.from('alixdocs_documents').select('category_id').eq('id', document_id).single();
      if (doc?.category_id) {
        const { data } = await svc.from('alixdocs_approval_chains').select('*').eq('category_id', doc.category_id).eq('active', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
        chain = data;
      }
    }
    if (!chain) return json(400, { error: 'Keine aktive Genehmigungskette gefunden.' });
    const steps = Array.isArray(chain.steps) ? chain.steps : [];
    if (steps.length === 0) return json(400, { error: 'Kette hat keine Schritte.' });

    const first = steps[0];
    const { data: state, error } = await svc.from('alixdocs_approval_states').insert({
      document_id, chain_id: chain.id, status: 'pending', current_step: 0,
      current_approver: first?.user_id ?? null, created_by: user.id,
      history: [{ action: 'started', by: user.id, at: new Date().toISOString() }],
    }).select('id').single();
    if (error) throw error;

    // Notify approver
    if (first?.user_id) {
      await svc.from('app_notifications').insert({
        user_id: first.user_id,
        title: 'Dokument-Freigabe angefordert',
        message: `Ein AlixDocs-Dokument wartet auf deine Freigabe (Schritt 1).`,
        category: 'alixdocs_approval',
        priority: 'high',
        metadata: { document_id, state_id: state.id },
        action_url: `/dokumente/freigaben`,
      });
    }

    return json(200, { ok: true, state_id: state.id });
  } catch (e: any) {
    return json(500, { error: e?.message ?? String(e) });
  }
});
