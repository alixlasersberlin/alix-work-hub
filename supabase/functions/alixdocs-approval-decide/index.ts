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

    const { state_id, decision, comment } = await req.json();
    if (!state_id || !['approved', 'rejected'].includes(decision)) return json(400, { error: 'invalid input' });

    const svc = createClient(url, service);
    const { data: state, error: sErr } = await svc.from('alixdocs_approval_states').select('*, alixdocs_approval_chains(steps)').eq('id', state_id).single();
    if (sErr || !state) return json(404, { error: 'state not found' });
    if (state.status !== 'pending') return json(400, { error: 'not pending' });
    if (state.current_approver && state.current_approver !== user.id) return json(403, { error: 'not your step' });

    const steps: any[] = state.alixdocs_approval_chains?.steps ?? [];
    const history = [...(state.history ?? []), { by: user.id, decision, comment: comment ?? null, step: state.current_step, at: new Date().toISOString() }];

    const nextStep = state.current_step + 1;
    const finished = decision === 'rejected' || nextStep >= steps.length;
    const nextApprover = finished ? null : steps[nextStep]?.user_id ?? null;

    const { error: uErr } = await svc.from('alixdocs_approval_states').update({
      status: finished ? decision : 'pending',
      current_step: finished ? state.current_step : nextStep,
      current_approver: nextApprover, history,
    }).eq('id', state_id);
    if (uErr) throw uErr;

    if (finished && decision === 'approved') {
      await svc.from('alixdocs_documents').update({ status: 'freigegeben' }).eq('id', state.document_id);
      await svc.from('alixdocs_audit_log').insert({ document_id: state.document_id, user_id: user.id, action: 'approved', metadata: { state_id } });
    }
    if (finished && decision === 'rejected') {
      await svc.from('alixdocs_audit_log').insert({ document_id: state.document_id, user_id: user.id, action: 'rejected', metadata: { state_id, comment } });
    }

    if (!finished && nextApprover) {
      await svc.from('app_notifications').insert({
        user_id: nextApprover,
        title: 'Dokument-Freigabe angefordert',
        message: `Nächster Freigabeschritt (${nextStep + 1}) wartet auf dich.`,
        category: 'alixdocs_approval',
        priority: 'high',
        metadata: { document_id: state.document_id, state_id },
        action_url: '/dokumente/freigaben',
      });
    }

    return json(200, { ok: true, finished, decision });
  } catch (e: any) {
    return json(500, { error: e?.message ?? String(e) });
  }
});
