// Auto-Reminder Cron: liest alixsmart_reminder_settings, findet fällige Kunden
// (Status unregistered/possible/reminded) und triggert alixsmart-send-reminder.
// Läuft stündlich. Auth: CRON_SECRET oder service role.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  const cronSecret = Deno.env.get('CRON_SECRET') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const url = Deno.env.get('SUPABASE_URL')!;
  if (!token || (token !== cronSecret && token !== serviceKey)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const svc = createClient(url, serviceKey);
  const now = new Date();

  const { data: cfg } = await svc.from('alixsmart_reminder_settings').select('*').limit(1).maybeSingle();
  if (!cfg || !cfg.enabled) return json({ ok: true, skipped: 'disabled' });

  // Ruhezeiten
  const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  if (cfg.quiet_hours_start && cfg.quiet_hours_end) {
    const s = String(cfg.quiet_hours_start).slice(0,5);
    const e = String(cfg.quiet_hours_end).slice(0,5);
    const inQuiet = s < e ? (hhmm >= s && hhmm < e) : (hhmm >= s || hhmm < e);
    if (inQuiet) return json({ ok: true, skipped: 'quiet_hours' });
  }
  if (cfg.weekend_pause && (now.getDay() === 0 || now.getDay() === 6)) {
    return json({ ok: true, skipped: 'weekend' });
  }

  // Kandidaten laden (nicht registriert)
  const { data: rows, error } = await svc
    .from('v_alixsmart_customer_status' as any)
    .select('customer_id, match_status, last_reminder_at, registered_at')
    .in('match_status', ['unregistered', 'possible', 'reminded'])
    .limit(500);
  if (error) return json({ error: error.message }, 500);

  const dayMs = 24 * 3600 * 1000;
  const [d1, d2, d3] = [cfg.first_after_days, cfg.second_after_days, cfg.third_after_days];

  // Reminder-Zähler pro Kunde
  const ids = (rows || []).map((r: any) => r.customer_id);
  const counts = new Map<string, number>();
  if (ids.length) {
    const { data: rc } = await svc.from('alixsmart_reminders').select('customer_id').in('customer_id', ids);
    (rc || []).forEach((r: any) => counts.set(r.customer_id, (counts.get(r.customer_id) || 0) + 1));
  }

  const dueEmail: string[] = [];
  const dueSms: string[] = [];
  for (const r of rows || []) {
    const cnt = counts.get((r as any).customer_id) || 0;
    if (cnt >= cfg.max_reminders) continue;
    const last = (r as any).last_reminder_at ? new Date((r as any).last_reminder_at).getTime() : 0;
    const daysSince = last ? (now.getTime() - last) / dayMs : Infinity;
    const threshold = cnt === 0 ? d1 : cnt === 1 ? d2 : d3;
    if (daysSince < threshold) continue;

    if (cfg.channel === 'email' || cfg.channel === 'both') dueEmail.push((r as any).customer_id);
    if (cfg.channel === 'sms' || cfg.channel === 'both') dueSms.push((r as any).customer_id);
  }

  async function invoke(channel: 'email'|'sms', customer_ids: string[]) {
    if (!customer_ids.length) return { sent: 0 };
    const res = await fetch(`${url}/functions/v1/alixsmart-send-reminder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ customer_ids, channel }),
    });
    return await res.json().catch(() => ({ sent: 0 }));
  }

  const [emailRes, smsRes] = await Promise.all([invoke('email', dueEmail), invoke('sms', dueSms)]);

  return json({
    ok: true, candidates: rows?.length ?? 0,
    email_planned: dueEmail.length, email_sent: emailRes?.sent ?? 0,
    sms_planned: dueSms.length, sms_sent: smsRes?.sent ?? 0,
  });
});

function json(v: unknown, status = 200) {
  return new Response(JSON.stringify(v), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
