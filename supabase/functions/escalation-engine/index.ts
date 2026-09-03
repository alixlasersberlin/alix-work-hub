// escalation-engine — plant, storniert und löst Eskalationen für ALIX INBOX Conversations aus.
// Läuft per Cron (jede Minute). Kein Client-Zugriff mit Geheimnissen.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

const FN_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-mobile-notification`;

async function dispatch(body: Record<string, unknown>) {
  const res = await fetch(FN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.error('dispatch failed', res.status, await res.text());
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const now = new Date();
  const result = { scheduled: 0, cancelled: 0, triggered: 0, failed: 0 };

  try {
    const { data: rules } = await admin.from('escalation_rules').select('*').eq('is_active', true);

    // --- 1) PLANEN: unbeantwortete Kundennachrichten ---
    const { data: convs } = await admin.from('ac_conversations')
      .select('id, priority, assigned_department, category, assigned_to, inbox_status, last_customer_message_at, last_agent_message_at, first_response_at, channel_id')
      .not('inbox_status', 'in', '("RESOLVED","ARCHIVED")')
      .not('last_customer_message_at', 'is', null)
      .gte('last_customer_message_at', new Date(now.getTime() - 24 * 3600_000).toISOString())
      .limit(500);

    for (const c of convs ?? []) {
      const answered = c.last_agent_message_at && new Date(c.last_agent_message_at) > new Date(c.last_customer_message_at!);
      if (answered) continue;
      const prio = (c.priority ?? 'P3').toUpperCase();
      const dept = (c.assigned_department || c.category || null);
      const rule = (rules ?? []).find((r: any) =>
        (r.priority ?? prio) === prio && (!r.department || r.department === dept)
        && (!r.channel_id || r.channel_id === c.channel_id));
      if (!rule) continue;

      const { data: existing } = await admin.from('conversation_escalations')
        .select('id').eq('conversation_id', c.id).eq('status', 'SCHEDULED').limit(1);
      if (existing?.length) continue;

      const base = new Date(c.last_customer_message_at!).getTime();
      const levels = [
        { lvl: 1, min: rule.first_reminder_minutes },
        { lvl: 2, min: rule.second_reminder_minutes },
        { lvl: 3, min: rule.escalate_minutes },
      ].filter((l) => typeof l.min === 'number' && l.min! > 0);
      if (!levels.length) continue;

      const rows = levels.map((l) => ({
        conversation_id: c.id,
        rule_id: rule.id,
        escalation_level: l.lvl,
        scheduled_for: new Date(base + l.min! * 60_000).toISOString(),
        status: 'SCHEDULED',
        target_user_id: l.lvl === 3 ? (rule.escalate_to_user_id ?? c.assigned_to ?? null) : (c.assigned_to ?? null),
        target_role: l.lvl === 3 ? (rule.escalate_to_role ?? null) : null,
      }));
      const { error } = await admin.from('conversation_escalations').insert(rows);
      if (!error) {
        result.scheduled += rows.length;
        await admin.from('ac_conversation_events').insert({
          conversation_id: c.id, event_type: 'ESCALATION_SCHEDULED',
          new_value: { rule: rule.name, levels: levels.map((l) => l.lvl) },
        });
      }
    }

    // --- 2) STORNIEREN: beantwortet / erledigt / archiviert / Priorität gesenkt ---
    const { data: pending } = await admin.from('conversation_escalations')
      .select('id, conversation_id, escalation_level, scheduled_for, target_user_id, target_role, rule_id')
      .eq('status', 'SCHEDULED').limit(1000);

    const convIds = Array.from(new Set((pending ?? []).map((e) => e.conversation_id)));
    const convMap = new Map<string, any>();
    if (convIds.length) {
      const { data } = await admin.from('ac_conversations')
        .select('id, inbox_status, priority, last_customer_message_at, last_agent_message_at, first_response_at, resolved_at, assigned_department, category')
        .in('id', convIds);
      for (const c of data ?? []) convMap.set(c.id, c);
    }

    for (const esc of pending ?? []) {
      const c = convMap.get(esc.conversation_id);
      if (!c) continue;
      const answered = !!c.first_response_at
        || (c.last_agent_message_at && c.last_customer_message_at
          && new Date(c.last_agent_message_at) > new Date(c.last_customer_message_at));
      const done = ['RESOLVED', 'ARCHIVED'].includes(c.inbox_status ?? '');
      const lowered = !['P1', 'P2'].includes((c.priority ?? '').toUpperCase());

      if (answered || done || lowered) {
        await admin.from('conversation_escalations')
          .update({ status: 'CANCELLED', cancelled_at: now.toISOString() }).eq('id', esc.id);
        result.cancelled++;
        await admin.from('ac_conversation_events').insert({
          conversation_id: esc.conversation_id, event_type: 'ESCALATION_CANCELLED',
          new_value: { level: esc.escalation_level, reason: answered ? 'answered' : done ? 'closed' : 'priority_lowered' },
        });
        continue;
      }

      // --- 3) AUSLÖSEN ---
      if (new Date(esc.scheduled_for) <= now) {
        const ok = await dispatch({
          notification_type: 'ESCALATION',
          conversation_id: esc.conversation_id,
          priority: (c.priority ?? 'P2').toUpperCase(),
          target_user_ids: esc.target_user_id ? [esc.target_user_id] : undefined,
          target_role: !esc.target_user_id ? (esc.target_role ?? undefined) : undefined,
          title: `Eskalation Stufe ${esc.escalation_level}`,
          dedup_suffix: `esc-${esc.id}`,
        });
        await admin.from('conversation_escalations').update({
          status: ok ? 'TRIGGERED' : 'FAILED',
          triggered_at: now.toISOString(),
        }).eq('id', esc.id);
        await admin.from('ac_conversation_events').insert({
          conversation_id: esc.conversation_id, event_type: 'ESCALATION_TRIGGERED',
          new_value: { level: esc.escalation_level, ok },
        });
        ok ? result.triggered++ : result.failed++;
      }
    }

    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('escalation-engine error', e);
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
