// ALIX COLLECT – Engine
// Baut Forderungsfälle aus offenen Rechnungen auf, ermittelt Mahnstufen und
// erzeugt Handlungsvorschläge (Events + next_action). Versendet NICHTS automatisch.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const started = Date.now();
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1) Fälle aus zoho_invoices aufbauen
    const { data: syncRes, error: syncErr } = await admin.rpc('collect_sync_cases');
    if (syncErr) throw syncErr;

    // 2) Stufenkonfiguration laden
    const { data: stages } = await admin
      .from('collect_stage_config')
      .select('*')
      .eq('active', true)
      .order('day_offset', { ascending: true });
    const stageMap = new Map<string, any>((stages ?? []).map((s: any) => [s.code, s]));

    // 3) Aktive Fälle durchgehen und Vorschläge erzeugen
    const { data: cases } = await admin
      .from('collect_cases')
      .select('id, customer_name, customer_email, stage_code, status, overdue_amount, open_amount, max_days_overdue, next_action, next_action_at, last_contact_at, paused_until')
      .neq('status', 'closed')
      .order('overdue_amount', { ascending: false })
      .limit(2000);

    const today = new Date().toISOString().slice(0, 10);
    let proposals = 0;
    let blocksSet = 0;

    for (const c of cases ?? []) {
      if (c.paused_until && c.paused_until >= today) continue;
      const stage = stageMap.get(c.stage_code ?? '');
      if (!stage) continue;

      // Wurde für diese Stufe schon etwas protokolliert?
      const { count } = await admin
        .from('collect_events')
        .select('id', { count: 'exact', head: true })
        .eq('case_id', c.id)
        .eq('stage_code', stage.code)
        .in('event_type', ['proposal', 'email_sent', 'sms_sent', 'call', 'letter_sent']);
      if ((count ?? 0) > 0) continue;

      const channels: string[] = Array.isArray(stage.channels) ? stage.channels : ['email'];
      await admin.from('collect_events').insert({
        case_id: c.id,
        event_type: 'proposal',
        channel: channels[0] ?? 'email',
        stage_code: stage.code,
        subject: `Vorschlag: ${stage.label}`,
        body: `Fällig seit ${c.max_days_overdue} Tagen · offen ${Number(c.overdue_amount ?? 0).toFixed(2)}. Empfohlene Maßnahme: ${stage.label} (${channels.join(', ')}).`,
        automated: true,
        meta: { day_offset: stage.day_offset, attach_pdf: stage.attach_pdf, pay_now_link: stage.pay_now_link },
      });
      proposals++;

      await admin.from('collect_cases').update({
        next_action: stage.label,
        next_action_at: new Date().toISOString(),
      }).eq('id', c.id);

      // Automatische Sperren gemäß Stufe
      const blocks: string[] = Array.isArray(stage.set_blocks) ? stage.set_blocks : [];
      for (const b of blocks) {
        const { count: has } = await admin
          .from('collect_blocks')
          .select('id', { count: 'exact', head: true })
          .eq('case_id', c.id).eq('block_type', b).eq('active', true);
        if ((has ?? 0) === 0) {
          await admin.from('collect_blocks').insert({
            case_id: c.id, block_type: b, active: true,
            reason: `Automatisch gesetzt bei Stufe ${stage.label}`, set_automatically: true,
          });
          blocksSet++;
        }
      }
    }

    return json({ ok: true, sync: syncRes, cases: cases?.length ?? 0, proposals, blocks_set: blocksSet, ms: Date.now() - started });
  } catch (e: any) {
    console.error('collect-engine failed:', e?.message ?? e);
    return json({ ok: false, error: e?.message ?? 'internal' }, 500);
  }
});
