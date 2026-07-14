// Reminder Materializer: erzeugt aus esc_events + appointment_reminder_rules
// konkrete Einträge in appointment_reminders (idempotent).
// Läuft per Cron alle 5 Minuten. Auth: CRON_SECRET oder service role.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  const cronSecret = Deno.env.get('CRON_SECRET') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (!token || (token !== cronSecret && token !== serviceKey)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const svc = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);

  // Lookahead: 48h in die Zukunft, 15 min in die Vergangenheit (für "überfällig 10 min").
  const now = new Date();
  const from = new Date(now.getTime() - 30 * 60 * 1000);
  const to = new Date(now.getTime() + 48 * 3600 * 1000);

  const { data: events, error: evErr } = await svc
    .from('esc_events')
    .select('id,title,start_at,end_at,event_type_id,department_id,assigned_user_id,status,customer_name,location,requires_confirmation,confirmation_status,deleted_at')
    .is('deleted_at', null)
    .gte('start_at', from.toISOString())
    .lte('start_at', to.toISOString())
    .not('assigned_user_id', 'is', null)
    .limit(500);
  if (evErr) return json({ error: evErr.message }, 500);

  const { data: rules, error: ruErr } = await svc
    .from('appointment_reminder_rules')
    .select('*')
    .eq('active', true);
  if (ruErr) return json({ error: ruErr.message }, 500);

  let created = 0, skipped = 0;
  const inserts: any[] = [];

  for (const ev of events ?? []) {
    if (['cancelled', 'completed', 'no_show'].includes(String(ev.status || ''))) { skipped++; continue; }
    const eventStart = new Date(ev.start_at).getTime();

    for (const r of rules ?? []) {
      // Regel greift, wenn: kein event_type/department gesetzt (global) ODER passt
      if (r.event_type_id && r.event_type_id !== ev.event_type_id) continue;
      if (r.department_id && r.department_id !== ev.department_id) continue;

      const scheduled = new Date(eventStart - Number(r.minutes_before) * 60 * 1000);
      // Nur zukünftige oder ganz frische geplant setzen
      if (scheduled.getTime() < now.getTime() - 10 * 60 * 1000) continue;

      const idem = `${ev.id}|${r.id}|${ev.assigned_user_id}|${scheduled.toISOString()}`;
      inserts.push({
        event_id: ev.id,
        user_id: ev.assigned_user_id,
        rule_id: r.id,
        channel: r.channel,
        scheduled_at: scheduled.toISOString(),
        status: 'planned',
        idempotency_key: idem,
        payload: {
          title: ev.title,
          location: ev.location,
          customer: ev.customer_name,
          escalation_level: r.escalation_level,
        },
      });
    }
  }

  if (inserts.length > 0) {
    // ON CONFLICT DO NOTHING via upsert with ignoreDuplicates
    const { error, count } = await svc
      .from('appointment_reminders')
      .upsert(inserts, { onConflict: 'idempotency_key', ignoreDuplicates: true, count: 'exact' });
    if (error) return json({ error: error.message }, 500);
    created = count ?? 0;
  }

  return json({ ok: true, events: events?.length ?? 0, rules: rules?.length ?? 0, planned: inserts.length, created, skipped });
});

function json(v: unknown, status = 200) {
  return new Response(JSON.stringify(v), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
