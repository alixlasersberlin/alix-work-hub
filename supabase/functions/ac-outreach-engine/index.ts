// ALIX CONNECT — Phase 26 Proactive Outreach Engine
// Wertet aktive ac_outreach_triggers aus, prüft Bedingungen, throttlet und legt Runs an.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const now = new Date();

    const { data: triggers } = await sb.from('ac_outreach_triggers').select('*').eq('enabled', true);
    if (!triggers?.length) return json({ ok: true, triggers: 0 });

    let queued = 0, skipped = 0;
    for (const t of triggers) {
      const conditions = (t.conditions ?? {}) as any;
      const candidates = await pickCandidates(sb, t.event_type, conditions);

      for (const cand of candidates) {
        // Throttle: skip if a run in throttle window already exists
        const throttleDays = Number(t.throttle_per_customer_days ?? 30);
        const cutoff = new Date(now.getTime() - throttleDays * 86_400_000).toISOString();
        const { data: recent } = await sb
          .from('ac_outreach_runs')
          .select('id')
          .eq('trigger_id', t.id)
          .eq('customer_id', cand.customer_id)
          .gte('created_at', cutoff)
          .limit(1);
        if (recent?.length) { skipped++; continue; }

        const scheduled = new Date(now);
        const targetHour = Number(t.send_hour_local ?? 10);
        if (scheduled.getHours() > targetHour) scheduled.setDate(scheduled.getDate() + 1);
        scheduled.setHours(targetHour, 0, 0, 0);

        await sb.from('ac_outreach_runs').insert({
          trigger_id: t.id,
          contact_id: cand.contact_id,
          customer_id: cand.customer_id,
          channel: t.channel,
          status: 'queued',
          scheduled_for: scheduled.toISOString(),
          payload: { context: cand.context, template_id: t.template_id, message_template: t.message_template },
        });
        queued++;
      }
    }
    return json({ ok: true, triggers: triggers.length, queued, skipped });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function pickCandidates(sb: any, eventType: string, cond: any): Promise<Array<{ contact_id: string | null, customer_id: string | null, context: any }>> {
  const out: any[] = [];
  const daysBefore = Number(cond?.days_before ?? 30);
  const in_days = new Date(Date.now() + daysBefore * 86_400_000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  if (eventType === 'maintenance_due') {
    const { data } = await sb.from('device_maintenance').select('customer_id, next_maintenance_date, device_id').gte('next_maintenance_date', today).lte('next_maintenance_date', in_days).limit(500);
    (data ?? []).forEach((d: any) => out.push({ contact_id: null, customer_id: d.customer_id, context: { next: d.next_maintenance_date, device: d.device_id } }));
  } else if (eventType === 'contract_expiring') {
    const { data } = await sb.from('finance_contracts').select('customer_id, end_date, id').gte('end_date', today).lte('end_date', in_days).limit(500);
    (data ?? []).forEach((d: any) => out.push({ contact_id: null, customer_id: d.customer_id, context: { end: d.end_date, contract: d.id } }));
  } else if (eventType === 'warranty_ending') {
    const { data } = await sb.from('warranty_records').select('customer_id, warranty_end, id').gte('warranty_end', today).lte('warranty_end', in_days).limit(500);
    (data ?? []).forEach((d: any) => out.push({ contact_id: null, customer_id: d.customer_id, context: { end: d.warranty_end, record: d.id } }));
  } else if (eventType === 'churn_risk') {
    const min = Number(cond?.min_score ?? 0.66);
    const { data } = await sb.from('ac_predictions').select('contact_id, customer_id, score, reason').eq('kind', 'churn').gte('score', min).order('score', { ascending: false }).limit(500);
    (data ?? []).forEach((d: any) => out.push({ contact_id: d.contact_id, customer_id: d.customer_id, context: { churn: d.score, reason: d.reason } }));
  } else if (eventType === 'no_contact_days') {
    const days = Number(cond?.days ?? 90);
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
    const { data } = await sb.from('ac_contacts').select('id, customer_id, last_contacted_at').lt('last_contacted_at', cutoff).limit(500);
    (data ?? []).forEach((d: any) => out.push({ contact_id: d.id, customer_id: d.customer_id, context: { last: d.last_contacted_at } }));
  }
  return out;
}
