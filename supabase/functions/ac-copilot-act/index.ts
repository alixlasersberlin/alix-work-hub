import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Copilot Agent Actions (Tool-Use).
 * POST { action: 'create_ticket'|'enroll_journey'|'notify_admin'|'update_contact', params: {...} }
 * Header: Authorization: Bearer <user JWT>
 * Guardrails: Admin/Super Admin only for destructive actions; always audit-logged.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const authHeader = req.headers.get('Authorization') ?? '';
  const sbUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const { data: userRes } = await sbUser.auth.getUser();
    const user = userRes?.user;
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const { action, params } = await req.json();
    if (!action) return json({ error: 'action required' }, 400);

    const { data: roles } = await sb.from('user_roles').select('role').eq('user_id', user.id);
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    const isAdmin = roleSet.has('Admin') || roleSet.has('Super Admin');

    let result: any = null;
    let status = 'success';
    let error: string | null = null;
    try {
      switch (action) {
        case 'create_ticket': {
          const { subject, description, priority = 'normal', customer_id } = params ?? {};
          if (!subject) throw new Error('subject required');
          const { data, error: e } = await sb.from('tickets').insert({
            subject, description: description ?? '', priority, status: 'open',
            customer_id: customer_id ?? null, created_by: user.id, source: 'copilot',
          }).select('id').single();
          if (e) throw e;
          result = { ticket_id: data.id };
          break;
        }
        case 'enroll_journey': {
          if (!isAdmin) throw new Error('Admin required');
          const { journey_id, contact_id } = params ?? {};
          if (!journey_id || !contact_id) throw new Error('journey_id & contact_id required');
          const { data, error: e } = await sb.from('ac_journey_runs').insert({
            journey_id, contact_id, current_step: 0, status: 'active',
            next_action_at: new Date().toISOString(), context: { source: 'copilot', by: user.id },
          }).select('id').single();
          if (e) throw e;
          result = { run_id: data.id };
          break;
        }
        case 'notify_admin': {
          const { title, message, target_user_id } = params ?? {};
          if (!title) throw new Error('title required');
          const { error: e } = await sb.from('app_notifications').insert({
            user_id: target_user_id ?? user.id, kind: 'copilot',
            severity: 'info', title, message: message ?? '',
          });
          if (e) throw e;
          result = { ok: true };
          break;
        }
        case 'update_contact': {
          if (!isAdmin) throw new Error('Admin required');
          const { contact_id, fields } = params ?? {};
          if (!contact_id || !fields) throw new Error('contact_id & fields required');
          const safe: Record<string, any> = {};
          for (const k of ['display_name', 'email', 'phone', 'tags', 'notes']) if (k in fields) safe[k] = fields[k];
          const { error: e } = await sb.from('ac_contacts').update(safe).eq('id', contact_id);
          if (e) throw e;
          result = { updated: Object.keys(safe) };
          break;
        }
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (e: any) {
      status = 'error'; error = String(e?.message ?? e);
    }

    await sb.from('ac_copilot_actions').insert({
      user_id: user.id, action_type: action, params: params ?? {}, result, status, error,
    });

    return json({ status, result, error }, status === 'success' ? 200 : 400);
  } catch (e: any) {
    return json({ error: e?.message ?? 'internal' }, 500);
  }
});
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
