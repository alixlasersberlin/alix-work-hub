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

    // 3b) Fehlende Kontaktdaten aus Kundenstamm nachtragen
    const missing = (cases ?? []).filter((c: any) => !c.customer_email && c.customer_name);
    if (missing.length) {
      const names = Array.from(new Set(missing.map((c: any) => c.customer_name)));
      const contacts = new Map<string, { email: string | null; phone: string | null }>();
      for (let i = 0; i < names.length; i += 200) {
        const { data: cust } = await admin
          .from('customers').select('company_name, email, phone').in('company_name', names.slice(i, i + 200));
        (cust ?? []).forEach((x: any) => { if (x.email || x.phone) contacts.set(x.company_name, { email: x.email, phone: x.phone }); });
      }
      for (const c of missing) {
        const hit = contacts.get(c.customer_name);
        if (!hit?.email && !hit?.phone) continue;
        await admin.from('collect_cases')
          .update({ customer_email: hit.email, customer_phone: hit.phone }).eq('id', c.id);
        c.customer_email = hit.email;
      }
    }


    const today = new Date().toISOString().slice(0, 10);
    const caseIds = (cases ?? []).map((c: any) => c.id);

    // Bestehende Protokolleinträge & Sperren gebündelt laden (statt pro Fall)
    const done = new Set<string>();
    const activeBlocks = new Set<string>();
    for (let i = 0; i < caseIds.length; i += 500) {
      const chunk = caseIds.slice(i, i + 500);
      const [{ data: evs }, { data: bls }] = await Promise.all([
        admin.from('collect_events').select('case_id, stage_code')
          .in('case_id', chunk)
          .in('event_type', ['proposal', 'email_sent', 'sms_sent', 'call', 'letter_sent']),
        admin.from('collect_blocks').select('case_id, block_type').in('case_id', chunk).eq('active', true),
      ]);
      (evs ?? []).forEach((e: any) => done.add(`${e.case_id}|${e.stage_code ?? ''}`));
      (bls ?? []).forEach((b: any) => activeBlocks.add(`${b.case_id}|${b.block_type}`));
    }

    const newEvents: any[] = [];
    const newBlocks: any[] = [];
    const nextActions: { id: string; label: string }[] = [];
    const now = new Date().toISOString();

    for (const c of cases ?? []) {
      if (c.paused_until && c.paused_until >= today) continue;
      const stage = stageMap.get(c.stage_code ?? '');
      if (!stage) continue;
      if (done.has(`${c.id}|${stage.code}`)) continue;

      const channels: string[] = Array.isArray(stage.channels) ? stage.channels : ['email'];
      newEvents.push({
        case_id: c.id,
        event_type: 'proposal',
        channel: channels[0] ?? 'email',
        stage_code: stage.code,
        subject: `Vorschlag: ${stage.label}`,
        body: `Fällig seit ${c.max_days_overdue} Tagen · offen ${Number(c.overdue_amount ?? 0).toFixed(2)}. Empfohlene Maßnahme: ${stage.label} (${channels.join(', ')}).`,
        automated: true,
        meta: { day_offset: stage.day_offset, attach_pdf: stage.attach_pdf, pay_now_link: stage.pay_now_link },
      });
      nextActions.push({ id: c.id, label: stage.label });

      const blocks: string[] = Array.isArray(stage.set_blocks) ? stage.set_blocks : [];
      for (const b of blocks) {
        if (activeBlocks.has(`${c.id}|${b}`)) continue;
        activeBlocks.add(`${c.id}|${b}`);
        newBlocks.push({
          case_id: c.id, block_type: b, active: true,
          reason: `Automatisch gesetzt bei Stufe ${stage.label}`, set_automatically: true,
        });
      }
    }

    for (let i = 0; i < newEvents.length; i += 500) {
      await admin.from('collect_events').insert(newEvents.slice(i, i + 500));
    }
    for (let i = 0; i < newBlocks.length; i += 500) {
      await admin.from('collect_blocks').insert(newBlocks.slice(i, i + 500));
    }
    // next_action gruppiert je Stufenbezeichnung aktualisieren
    const byLabel = new Map<string, string[]>();
    nextActions.forEach((n) => byLabel.set(n.label, [...(byLabel.get(n.label) ?? []), n.id]));
    for (const [label, ids] of byLabel) {
      for (let i = 0; i < ids.length; i += 500) {
        await admin.from('collect_cases')
          .update({ next_action: label, next_action_at: now })
          .in('id', ids.slice(i, i + 500));
      }
    }

    // 4) Gebrochene Zahlungsversprechen erkennen
    let brokenPromises = 0;
    const { data: promises } = await admin
      .from('collect_promises')
      .select('id, case_id, amount, promised_date')
      .eq('status', 'open')
      .lt('promised_date', today)
      .limit(1000);
    for (const p of promises ?? []) {
      await admin.from('collect_promises').update({ status: 'broken' }).eq('id', p.id);
      await admin.from('collect_events').insert({
        case_id: p.case_id, event_type: 'promise_broken', channel: 'system',
        title: 'Zahlungsversprechen nicht eingehalten',
        detail: `Zugesagt ${p.amount} EUR zum ${p.promised_date}`,
        created_automatically: true,
      });
      brokenPromises++;
    }

    // 5) Aufgaben erzeugen (nur wenn noch keine offene Aufgabe gleichen Typs existiert)
    const { data: openTasks } = await admin
      .from('collect_tasks').select('case_id, task_type').eq('status', 'open').limit(5000);
    const taskKeys = new Set((openTasks ?? []).map((t: any) => `${t.case_id}|${t.task_type}`));
    const newTasks: any[] = [];
    const pushTask = (case_id: string, task_type: string, title: string, priority: number) => {
      const k = `${case_id}|${task_type}`;
      if (taskKeys.has(k)) return;
      taskKeys.add(k);
      newTasks.push({ case_id, task_type, title, priority, status: 'open', due_date: today, created_automatically: true });
    };
    for (const p of promises ?? []) pushTask(p.case_id, 'promise_check', 'Gebrochenes Zahlungsversprechen prüfen', 1);
    for (const c of cases ?? []) {
      if (c.paused_until && c.paused_until > today) continue;
      const d = Number(c.max_days_overdue ?? 0);
      const amt = Number(c.overdue_amount ?? 0);
      if (amt <= 0) continue;
      if (d >= 60 || amt >= 10000) pushTask(c.id, 'call', `${c.customer_name}: anrufen (${Math.round(amt)} € / ${d} T)`, 1);
      else if (d >= 30) pushTask(c.id, 'dunning', `${c.customer_name}: Mahnung versenden`, 2);
      if (d >= 90) pushTask(c.id, 'escalation', `${c.customer_name}: Inkasso/Anwalt prüfen`, 1);
    }
    for (let i = 0; i < newTasks.length; i += 500) {
      await admin.from('collect_tasks').insert(newTasks.slice(i, i + 500));
    }

    const proposals = newEvents.length;
    const blocksSet = newBlocks.length;

    return json({ ok: true, sync: syncRes, cases: cases?.length ?? 0, proposals, blocks_set: blocksSet, tasks_created: newTasks.length, promises_broken: brokenPromises, ms: Date.now() - started });
  } catch (e: any) {
    console.error('collect-engine failed:', e?.message ?? e);
    return json({ ok: false, error: e?.message ?? 'internal' }, 500);
  }
});
