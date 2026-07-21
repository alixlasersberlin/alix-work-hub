// Aggregates KPIs across channels for the Executive Cockpit.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({} as any));
    const days = Math.max(1, Math.min(365, Number(body.days) || 30));
    const end = new Date();
    const start = new Date(end.getTime() - days * 86400_000);

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const [calls, messages, tickets, meetings] = await Promise.all([
      sb.from('ac_calls').select('id,direction,status,duration_seconds,sentiment,agent_user_id,started_at')
        .gte('started_at', start.toISOString()),
      sb.from('ac_messages').select('id,channel,direction,created_at')
        .gte('created_at', start.toISOString()),
      sb.from('tickets').select('id,status,priority,created_at,resolved_at')
        .gte('created_at', start.toISOString()),
      sb.from('ac_meetings').select('id,starts_at,ends_at,status').gte('starts_at', start.toISOString()),
    ]);

    const callRows = calls.data ?? [];
    const msgRows = messages.data ?? [];
    const ticketRows = tickets.data ?? [];
    const meetingRows = meetings.data ?? [];

    const bySentiment = { positiv: 0, neutral: 0, negativ: 0, unbekannt: 0 } as Record<string, number>;
    let totalDur = 0, missed = 0;
    for (const c of callRows) {
      const s = c.sentiment || 'unbekannt';
      bySentiment[s] = (bySentiment[s] ?? 0) + 1;
      totalDur += Number(c.duration_seconds ?? 0);
      if (c.status === 'missed' || c.status === 'no_answer') missed++;
    }

    const byChannel: Record<string, number> = {};
    for (const m of msgRows) byChannel[m.channel || 'other'] = (byChannel[m.channel || 'other'] ?? 0) + 1;

    let resolved = 0, ttrSum = 0, ttrN = 0;
    for (const t of ticketRows) {
      if (t.resolved_at) {
        resolved++;
        ttrSum += (new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime()) / 3_600_000;
        ttrN++;
      }
    }

    const kpis = {
      period: { start: start.toISOString(), end: end.toISOString(), days },
      calls: {
        total: callRows.length,
        missed,
        answered_rate: callRows.length ? Number(((callRows.length - missed) / callRows.length).toFixed(3)) : 0,
        avg_duration_sec: callRows.length ? Math.round(totalDur / callRows.length) : 0,
        sentiment: bySentiment,
      },
      messages: { total: msgRows.length, by_channel: byChannel },
      tickets: {
        total: ticketRows.length,
        resolved,
        resolution_rate: ticketRows.length ? Number((resolved / ticketRows.length).toFixed(3)) : 0,
        avg_ttr_hours: ttrN ? Number((ttrSum / ttrN).toFixed(2)) : null,
      },
      meetings: { total: meetingRows.length },
    };

    const { data, error } = await sb.from('ac_report_snapshots').insert({
      period_start: start.toISOString(),
      period_end: end.toISOString(),
      granularity: days <= 1 ? 'hour' : days <= 31 ? 'day' : 'week',
      channel: 'all',
      kpis,
    }).select().single();
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, snapshot: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
