// SLA-Engine für Tickets.
// - Nutzt ticket_departments.sla_hours (Fallback 48 h) als Basis
// - Priorität als Multiplikator (dringend/kritisch 0.5, hoch 0.75, normal 1, niedrig 1.5)
// - Setzt sla_status: ok | warning (>75%) | breach (>=100%)
// - Beim Übergang -> breach: escalation_count++, escalated_at=now,
//   erzeugt ticket_notifications an assigned_to (falls gesetzt) sowie an
//   alle Super Admins. Beim Übergang -> warning: Benachrichtigung an assigned_to.
// - Läuft stündlich via pg_cron.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CLOSED = ['geschlossen', 'closed', 'gelöst', 'geloest', 'resolved'];
const DEFAULT_SLA_HOURS = 48;

function priorityMultiplier(p?: string | null): number {
  const v = (p || '').toLowerCase();
  if (v === 'dringend' || v === 'kritisch' || v === 'urgent') return 0.5;
  if (v === 'hoch' || v === 'high') return 0.75;
  if (v === 'niedrig' || v === 'low') return 1.5;
  return 1;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Load open tickets
  const { data: tickets, error } = await supabase
    .from('tickets')
    .select('id,ticket_number,title,status,priority,assigned_to,created_at,due_at,sla_status,escalation_count,ticket_department_id')
    .not('status', 'in', `(${CLOSED.map((s) => `"${s}"`).join(',')})`)
    .limit(5000);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Load department SLA config
  const { data: depts } = await supabase
    .from('ticket_departments')
    .select('id,sla_hours');
  const deptSla: Record<string, number> = {};
  (depts || []).forEach((d: any) => { deptSla[d.id] = d.sla_hours || DEFAULT_SLA_HOURS; });

  // Cache Super-Admin user_ids
  let superAdminIds: string[] = [];
  const { data: saRoleRow } = await supabase.from('roles').select('id').eq('name', 'Super Admin').maybeSingle();
  if (saRoleRow?.id) {
    const { data: sa } = await supabase.from('user_roles').select('user_id').eq('role_id', saRoleRow.id);
    superAdminIds = (sa || []).map((r: any) => r.user_id);
  }

  const now = Date.now();
  const nowIso = new Date().toISOString();
  let updated = 0;
  let escalated = 0;

  async function notify(userIds: string[], ticketId: string, kind: string, title: string, message: string) {
    const rows = Array.from(new Set(userIds.filter(Boolean))).map((uid) => ({
      user_id: uid, ticket_id: ticketId, kind, title, message,
    }));
    if (rows.length) await supabase.from('ticket_notifications').insert(rows);
  }

  for (const t of tickets || []) {
    const slaH = deptSla[t.ticket_department_id as string] || DEFAULT_SLA_HOURS;
    const effH = slaH * priorityMultiplier(t.priority);
    const deadlineMs = t.due_at
      ? new Date(t.due_at).getTime()
      : new Date(t.created_at).getTime() + effH * 3600000;
    const totalMs = effH * 3600000;
    const elapsedRatio = 1 - (deadlineMs - now) / totalMs;

    let status: 'ok' | 'warning' | 'breach' = 'ok';
    if (elapsedRatio >= 1) status = 'breach';
    else if (elapsedRatio >= 0.75) status = 'warning';

    if (status === t.sla_status) continue;

    const patch: Record<string, unknown> = {
      sla_status: status,
      sla_last_check: nowIso,
    };
    if (status === 'breach' && t.sla_status !== 'breach') {
      patch.escalation_count = (t.escalation_count || 0) + 1;
      patch.escalated_at = nowIso;
      escalated++;
    }

    await supabase.from('tickets').update(patch).eq('id', t.id);
    updated++;

    const ref = t.ticket_number || t.id.slice(0, 8);
    if (status === 'warning') {
      if (t.assigned_to) {
        await notify([t.assigned_to as string], t.id as string, 'sla_warning',
          `SLA-Warnung: ${ref}`,
          `Ticket "${t.title}" nähert sich der SLA-Frist.`);
      }
    } else if (status === 'breach') {
      const recipients = [t.assigned_to as string, ...superAdminIds];
      await notify(recipients, t.id as string, 'sla_breach',
        `SLA überschritten: ${ref}`,
        `Ticket "${t.title}" hat die SLA-Frist überschritten. Bitte eskalieren.`);
      await supabase.from('ticket_history').insert({
        ticket_id: t.id, action: 'sla_breach',
        details: { priority: t.priority, sla_hours: effH, escalation_count: patch.escalation_count },
      });
    }
  }

  return new Response(JSON.stringify({ checked: tickets?.length || 0, updated, escalated }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
