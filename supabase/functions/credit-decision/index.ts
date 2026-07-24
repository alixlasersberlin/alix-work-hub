// ALIX CREDIT SCORE® – Entscheidungs-Endpunkt (Freigabe / Ablehnung / Eskalation)
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const STAGE_ROLES: Record<string, string[]> = {
  auto: ['Super Admin'],
  sales: ['Super Admin', 'Admin', 'Vertrieb', 'Vertriebsleitung', 'Geschäftsführung'],
  sales_lead: ['Super Admin', 'Admin', 'Vertriebsleitung', 'Geschäftsführung'],
  management: ['Super Admin', 'Admin', 'Geschäftsführung'],
  done: ['Super Admin'],
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body = await req.json();
    const { assessment_id, decision, reason } = body as { assessment_id: string; decision: 'approve' | 'approve_conditions' | 'reject' | 'escalate' | 'cancel'; reason?: string };
    if (!assessment_id || !decision) return json({ error: 'assessment_id and decision required' }, 400);

    const { data: a } = await sb.from('credit_assessments').select('*').eq('id', assessment_id).maybeSingle();
    if (!a) return json({ error: 'not found' }, 404);

    // Rollencheck
    const { data: roles } = await sb.from('user_roles').select('roles(name)').eq('user_id', user.id);
    const roleNames = (roles ?? []).map((r: any) => r.roles?.name).filter(Boolean);
    const allowed = STAGE_ROLES[a.workflow_stage] ?? ['Super Admin'];
    if (!roleNames.some((n: string) => allowed.includes(n))) {
      return json({ error: `Keine Berechtigung für Stufe ${a.workflow_stage}. Erlaubt: ${allowed.join(', ')}` }, 403);
    }

    let to_status = a.status;
    let to_stage = a.workflow_stage;
    let action = decision;
    switch (decision) {
      case 'approve': to_status = 'approved'; to_stage = 'done'; action = 'approved'; break;
      case 'approve_conditions': to_status = 'approved_with_conditions'; to_stage = 'done'; action = 'approved_with_conditions'; break;
      case 'reject': to_status = 'rejected'; to_stage = 'done'; action = 'rejected'; break;
      case 'cancel': to_status = 'cancelled'; to_stage = 'done'; action = 'cancelled'; break;
      case 'escalate':
        to_stage = a.workflow_stage === 'sales' ? 'sales_lead' : a.workflow_stage === 'sales_lead' ? 'management' : 'management';
        to_status = 'pending_review'; action = 'escalated'; break;
    }

    await sb.from('credit_assessments').update({
      status: to_status, workflow_stage: to_stage,
      decided_by: user.id, decided_at: new Date().toISOString(),
      decision_notes: reason ?? null,
    }).eq('id', assessment_id);

    await sb.from('credit_decision_log').insert({
      assessment_id, action, from_status: a.status, to_status, from_stage: a.workflow_stage, to_stage,
      reason: reason ?? null, actor: user.id, actor_email: user.email ?? null,
    });

    // E-Mail-Benachrichtigung an Ersteller + BCC rde@alix-lasers.com
    try {
      const { data: creator } = await sb.auth.admin.getUserById(a.created_by);
      const to = creator?.user?.email;
      if (to) {
        const snap = (a.customer_snapshot ?? {}) as Record<string, any>;
        const kunde = snap.name ?? snap.company_name ?? 'Kunde';
        const labelMap: Record<string, string> = {
          approved: 'freigegeben ✅',
          approved_with_conditions: 'mit Auflagen freigegeben ⚠️',
          rejected: 'abgelehnt ❌',
          escalated: `eskaliert an Stufe „${to_stage}"`,
          cancelled: 'zurückgezogen',
        };
        const subj = `ALIX CREDIT SCORE – Bonitätsprüfung ${kunde}: ${labelMap[action] ?? action}`;
        const html = `
          <div style="font-family:Arial,sans-serif;max-width:600px">
            <h2>ALIX CREDIT SCORE® – Entscheidung</h2>
            <p>Deine Bonitätsprüfung für <strong>${kunde}</strong> wurde <strong>${labelMap[action] ?? action}</strong>.</p>
            <ul>
              <li>Score: <strong>${a.score ?? '–'}</strong> / 1000 (${a.ampel ?? '–'})</li>
              <li>Neuer Status: <strong>${to_status}</strong></li>
              <li>Stufe: <strong>${to_stage}</strong></li>
              ${reason ? `<li>Begründung: ${reason}</li>` : ''}
              <li>Entschieden von: ${user.email ?? user.id}</li>
            </ul>
            <p><a href="https://app.alixwork.de/bonitaet/${assessment_id}">Zur Bonitätsprüfung öffnen</a></p>
          </div>`;
        await sb.functions.invoke('send-transactional-email', {
          body: { to, subject: subj, html, bcc: 'rde@alix-lasers.com', category: 'credit_decision' },
        });
      }
    } catch (mailErr) {
      console.warn('credit-decision mail failed:', mailErr);
    }

    return json({ ok: true, status: to_status, workflow_stage: to_stage });
  } catch (e: any) {
    console.error(e);
    return json({ error: e?.message ?? 'internal' }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
