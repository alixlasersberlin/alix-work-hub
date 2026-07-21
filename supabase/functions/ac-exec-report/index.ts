import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Weekly Exec Report (Cron Montags 07:00).
 * Aggregiert Kern-KPIs & mailt an alle Super Admins.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const since = new Date(Date.now() - 7 * 86400 * 1000).toISOString();

    const [convs, breaches, health, journeys, playbooks] = await Promise.all([
      sb.from('ac_conversations').select('id,status,priority', { count: 'exact', head: false }).gte('created_at', since),
      sb.from('ac_sla_breaches').select('id,breach_type', { count: 'exact', head: false }).gte('created_at', since),
      sb.from('ac_customer_health').select('score,stage'),
      sb.from('ac_journey_runs').select('id,status', { count: 'exact', head: false }).gte('created_at', since),
      sb.from('ac_lifecycle_runs').select('id,status', { count: 'exact', head: false }).gte('created_at', since),
    ]);

    const bucket = (arr: any[] | null, key: string) => {
      const m: Record<string, number> = {};
      (arr ?? []).forEach((r) => { m[r[key] ?? '—'] = (m[r[key] ?? '—'] ?? 0) + 1; });
      return m;
    };
    const avg = (arr: any[] | null, key: string) =>
      arr?.length ? Math.round(arr.reduce((s, r) => s + (Number(r[key]) || 0), 0) / arr.length) : 0;

    const kpi = {
      window_days: 7,
      conversations: convs.data?.length ?? 0,
      convs_by_status: bucket(convs.data, 'status'),
      sla_breaches: breaches.data?.length ?? 0,
      breaches_by_type: bucket(breaches.data, 'breach_type'),
      avg_health: avg(health.data, 'score'),
      health_by_stage: bucket(health.data, 'stage'),
      journey_runs: journeys.data?.length ?? 0,
      journeys_by_status: bucket(journeys.data, 'status'),
      playbook_runs: playbooks.data?.length ?? 0,
      playbooks_by_status: bucket(playbooks.data, 'status'),
    };

    const html = `
      <div style="font-family:system-ui;max-width:640px">
        <h2>ALIX CONNECT — Wochenreport</h2>
        <p style="color:#666">Zeitraum: letzte 7 Tage</p>
        <table style="border-collapse:collapse;width:100%">
          ${Object.entries(kpi).map(([k, v]) => `
            <tr><td style="padding:6px;border-bottom:1px solid #eee;color:#555">${k}</td>
                <td style="padding:6px;border-bottom:1px solid #eee"><b>${typeof v === 'object' ? JSON.stringify(v) : v}</b></td></tr>
          `).join('')}
        </table>
        <p style="color:#999;font-size:12px;margin-top:20px">Automatischer Report · <a href="https://alix-finance.de/connect/cockpit">Cockpit öffnen</a></p>
      </div>`;

    await sb.from('ac_report_snapshots').insert({
      report_type: 'weekly_exec', period_start: since, period_end: new Date().toISOString(),
      data: kpi,
    });

    const { data: admins } = await sb.from('user_roles').select('user_id').in('role', ['Super Admin', 'Admin']);
    const ids = Array.from(new Set((admins ?? []).map((r: any) => r.user_id)));
    const { data: profs } = await sb.from('user_profiles').select('user_id,email').in('user_id', ids);
    const emails = (profs ?? []).map((p: any) => p.email).filter(Boolean);

    let sent = 0;
    for (const to of emails) {
      const { error } = await sb.functions.invoke('send-email', {
        body: { to, subject: 'ALIX CONNECT — Wochenreport', html },
      });
      if (!error) sent++;
    }
    return json({ kpi, recipients: emails.length, sent });
  } catch (e: any) {
    return json({ error: e?.message ?? 'internal' }, 500);
  }
});
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
