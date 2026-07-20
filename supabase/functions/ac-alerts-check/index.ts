// Phase 13 – ALIX CONNECT Web Suite Alerts (cron every 15 min)
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendLovableEmail } from 'npm:@lovable.dev/email-js@0.0.4';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

async function notify(to: string, subject: string, text: string) {
  try {
    await sendLovableEmail({
      apiKey: Deno.env.get('LOVABLE_API_KEY')!,
      senderDomain: 'notify.alixlasers.ai',
      fromName: 'ALIX CONNECT Alerts',
      fromLocalPart: 'connect-alerts',
      to,
      subject,
      html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111"><pre style="white-space:pre-wrap;font-family:inherit">${
        text.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string))
      }</pre><hr/><p style="color:#666;font-size:12px">ALIX CONNECT · Web Suite Alerts</p></div>`,
      text,
    });
    return true;
  } catch (e) {
    console.error('mail failed', e);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  const now = new Date();
  const { data: alerts } = await admin
    .from('ac_web_alerts')
    .select('*, ac_websites!inner(domain, project_name, status)')
    .eq('is_active', true);

  const results: any[] = [];
  for (const a of (alerts ?? []) as any[]) {
    const site = a.ac_websites;
    if (!site || site.status !== 'active') continue;

    // Cooldown
    if (a.last_triggered_at) {
      const nextOk = new Date(a.last_triggered_at).getTime() + (a.cooldown_minutes ?? 240) * 60_000;
      if (nextOk > now.getTime()) { continue; }
    }

    const windowStart = new Date(now.getTime() - (a.window_minutes ?? 60) * 60_000).toISOString();
    let triggered = false;
    let subject = '';
    let body = '';

    try {
      if (a.kind === 'no_traffic') {
        const { count } = await admin
          .from('ac_analytics_events')
          .select('id', { count: 'exact', head: true })
          .eq('website_id', a.website_id)
          .gte('created_at', windowStart);
        if ((count ?? 0) <= (a.threshold ?? 0)) {
          triggered = true;
          subject = `⚠️ ${site.domain}: Kein Traffic seit ${a.window_minutes} min`;
          body = `Website: ${site.project_name} (${site.domain})\nZeitfenster: letzte ${a.window_minutes} Minuten\nEvents: ${count ?? 0} (Schwellwert: ${a.threshold})\n\nBitte prüfe Tracking und Erreichbarkeit.`;
        }
      } else if (a.kind === 'visitor_spike') {
        const { data } = await admin
          .from('ac_analytics_events')
          .select('visitor_hash')
          .eq('website_id', a.website_id)
          .gte('created_at', windowStart);
        const uniques = new Set((data ?? []).map((r: any) => r.visitor_hash)).size;
        if (uniques >= (a.threshold ?? 1)) {
          triggered = true;
          subject = `🚀 ${site.domain}: Besucher-Spike (${uniques})`;
          body = `Website: ${site.project_name} (${site.domain})\nUnique Besucher in letzten ${a.window_minutes} min: ${uniques} (Schwellwert: ${a.threshold})`;
        }
      } else if (a.kind === 'goal_completed') {
        const q = admin
          .from('ac_analytics_events')
          .select('id', { count: 'exact', head: true })
          .eq('website_id', a.website_id)
          .eq('is_conversion', true)
          .gte('created_at', windowStart);
        if (a.goal_id) q.eq('goal_id', a.goal_id);
        const { count } = await q;
        if ((count ?? 0) >= (a.threshold ?? 1)) {
          triggered = true;
          subject = `🎯 ${site.domain}: ${count} Conversion(s)`;
          body = `Website: ${site.project_name} (${site.domain})\nConversions in letzten ${a.window_minutes} min: ${count}${a.goal_id ? `\nZiel-ID: ${a.goal_id}` : ' (alle Ziele)'}`;
        }
      } else if (a.kind === 'daily_summary') {
        // Fire once per day at first check after 08:00 UTC
        const hourNow = now.getUTCHours();
        const lastFired = a.last_triggered_at ? new Date(a.last_triggered_at) : null;
        const sameDay = lastFired && lastFired.toISOString().slice(0, 10) === now.toISOString().slice(0, 10);
        if (hourNow >= 6 && !sameDay) {
          const startOfDay = new Date(now); startOfDay.setUTCHours(0, 0, 0, 0);
          const yesterday = new Date(startOfDay.getTime() - 864e5).toISOString();
          const [{ data: t }, { data: y }] = await Promise.all([
            admin.from('ac_analytics_events').select('visitor_hash, is_conversion').eq('website_id', a.website_id).gte('created_at', startOfDay.toISOString()),
            admin.from('ac_analytics_events').select('visitor_hash').eq('website_id', a.website_id).gte('created_at', yesterday).lt('created_at', startOfDay.toISOString()),
          ]);
          const todayU = new Set((t ?? []).map((r: any) => r.visitor_hash)).size;
          const yesterU = new Set((y ?? []).map((r: any) => r.visitor_hash)).size;
          const convs = (t ?? []).filter((r: any) => r.is_conversion).length;
          triggered = true;
          subject = `📊 ${site.domain}: Tagesreport`;
          body = `Website: ${site.project_name} (${site.domain})\n\nHeute (bisher):\n  Unique Besucher: ${todayU}\n  Events gesamt: ${t?.length ?? 0}\n  Conversions: ${convs}\n\nGestern:\n  Unique Besucher: ${yesterU}\n\nDashboard: https://app.alixwork.de/connect/websites/${a.website_id}/analytics`;
        }
      }

      if (triggered) {
        const sent = await notify(a.recipient_email, subject, body);
        await admin.from('ac_web_alerts').update({
          last_triggered_at: now.toISOString(),
          last_checked_at: now.toISOString(),
        }).eq('id', a.id);
        results.push({ id: a.id, kind: a.kind, triggered: true, sent });
      } else {
        await admin.from('ac_web_alerts').update({ last_checked_at: now.toISOString() }).eq('id', a.id);
        results.push({ id: a.id, kind: a.kind, triggered: false });
      }
    } catch (e: any) {
      console.error('alert error', a.id, e);
      results.push({ id: a.id, error: e.message });
    }
  }

  return json({ ok: true, checked: results.length, results });
});
