// ALIX COLLECT – Engine
// Baut Forderungsfälle aus offenen Rechnungen auf, ermittelt Mahnstufen, wendet
// Collections Playbooks an (Kulanz, Kanal, Reklamationssperre, Eskalation),
// berechnet Mahnkosten/Verzugszinsen und erzeugt Aufgaben. Versendet NICHTS automatisch.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

const OPEN_TICKET_STATES = ['open', 'new', 'in_progress', 'waiting_customer', 'pending', 'offen'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const started = Date.now();
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1) Fälle aus zoho_invoices aufbauen
    const { data: syncRes, error: syncErr } = await admin.rpc('collect_sync_cases');
    if (syncErr) throw syncErr;

    // 2) Stammdaten laden: Stufen, Playbooks, Gebührenregeln
    const [{ data: stages }, { data: playbooks }, { data: feeRules }] = await Promise.all([
      admin.from('collect_stage_config').select('*').eq('active', true).order('day_offset', { ascending: true }),
      admin.from('collect_playbooks').select('*').eq('active', true).order('priority', { ascending: true }),
      admin.from('collect_fee_rules').select('*').eq('active', true),
    ]);
    const stageMap = new Map<string, any>((stages ?? []).map((s: any) => [s.code, s]));

    // 3) Aktive Fälle
    const { data: cases } = await admin
      .from('collect_cases')
      .select('id, customer_id, customer_name, customer_email, stage_code, status, overdue_amount, open_amount, fee_amount, interest_amount, max_days_overdue, next_action, next_action_at, last_contact_at, paused_until, playbook_code, complaint_hold, country_code, customer_type, seller_name, health_score')
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
    const now = new Date().toISOString();
    const caseIds = (cases ?? []).map((c: any) => c.id);
    const caseNames = Array.from(new Set((cases ?? []).map((c: any) => c.customer_name).filter(Boolean)));

    // 4) Reklamationssperre: offene Tickets/Servicefälle je Kunde ermitteln
    const complaintCustomers = new Set<string>();
    for (let i = 0; i < caseNames.length; i += 200) {
      const chunk = caseNames.slice(i, i + 200);
      const { data: tix } = await admin
        .from('tickets').select('customer_name, status').in('customer_name', chunk).limit(2000);
      (tix ?? []).forEach((t: any) => {
        if (t.customer_name && OPEN_TICKET_STATES.includes(String(t.status ?? '').toLowerCase())) {
          complaintCustomers.add(t.customer_name);
        }
      });
    }

    // 5) Ratenpläne (für Playbook "ratenzahler")
    const installmentCustomers = new Set<string>();
    const { data: plans } = await admin
      .from('collect_payment_plans').select('case_id, status').eq('status', 'active').limit(2000);
    (plans ?? []).forEach((p: any) => installmentCustomers.add(p.case_id));

    // Bestehende Protokolleinträge & Sperren gebündelt laden
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

    // Playbook-Auswahl
    const pbByCode = new Map<string, any>((playbooks ?? []).map((p: any) => [p.code, p]));
    const pickPlaybook = (c: any) => {
      if (complaintCustomers.has(c.customer_name)) return pbByCode.get('reklamation');
      if (installmentCustomers.has(c.id)) return pbByCode.get('ratenzahler');
      const type = String(c.customer_type ?? '').toLowerCase();
      if (type && pbByCode.get(type)) return pbByCode.get(type);
      const country = String(c.country_code ?? 'DE').toUpperCase();
      if (country && country !== 'DE' && country !== 'AT') return pbByCode.get('international');
      const match = (playbooks ?? []).find((p: any) =>
        (!p.match_customer_type || p.match_customer_type === type) &&
        (!p.match_country || p.match_country === country) &&
        (!p.match_min_amount || Number(c.overdue_amount ?? 0) >= Number(p.match_min_amount)));
      return match ?? pbByCode.get('stammkunde') ?? null;
    };

    // Gebührenregel je Land + Stufe
    const feeFor = (country: string, stageCode: string) =>
      (feeRules ?? []).find((f: any) => f.country_code === country && f.stage_code === stageCode)
      ?? (feeRules ?? []).find((f: any) => f.country_code === country)
      ?? (feeRules ?? []).find((f: any) => f.country_code === 'DE' && f.stage_code === stageCode)
      ?? null;

    const newEvents: any[] = [];
    const newBlocks: any[] = [];
    const caseUpdates: any[] = [];
    let holds = 0;

    for (const c of cases ?? []) {
      const pb = pickPlaybook(c);
      const isComplaint = complaintCustomers.has(c.customer_name);
      const country = String(c.country_code ?? 'DE').toUpperCase();
      const days = Number(c.max_days_overdue ?? 0);
      const overdue = Number(c.overdue_amount ?? 0);

      // Verzugszinsen taggenau
      const rule = feeFor(country, c.stage_code ?? '');
      const ratePct = Number(rule?.interest_rate_pct ?? 9.12);
      const interest = overdue > 0 && days > 0 ? Math.round((overdue * (ratePct / 100) * (days / 365)) * 100) / 100 : 0;
      const fee = Number(rule?.fee_amount ?? 0);

      const patch: any = {
        id: c.id,
        playbook_code: pb?.code ?? null,
        complaint_hold: isComplaint && !!pb?.pause_on_complaint,
        complaint_hold_reason: isComplaint ? 'Offener Service-/Reklamationsfall' : null,
        interest_amount: interest,
        fee_amount: fee,
      };
      caseUpdates.push(patch);

      // Mahnstopp bei Reklamation
      if (patch.complaint_hold) {
        holds++;
        if (!done.has(`${c.id}|complaint_hold`)) {
          newEvents.push({
            case_id: c.id, event_type: 'proposal', channel: 'system', stage_code: 'complaint_hold',
            subject: 'Mahnstopp: Kunde reklamiert aktuell',
            body: `Offener Servicefall vorhanden – Mahnprozess pausiert (Playbook ${pb?.label ?? '—'}). Nach Abschluss startet die Mahnung automatisch wieder.`,
            automated: true, meta: { playbook: pb?.code },
          });
        }
        continue;
      }

      const stage = stageMap.get(c.stage_code ?? '');
      if (!stage) continue;
      if (c.paused_until && c.paused_until >= today) continue;
      // Playbook-Kulanz
      if (days < Number(stage.day_offset ?? 0) + Number(pb?.grace_days ?? 0)) continue;
      if (done.has(`${c.id}|${stage.code}`)) continue;

      const channels: string[] = Array.isArray(stage.channels) ? stage.channels : ['email'];
      const channel = pb?.personal_call ? 'phone' : (pb?.first_channel ?? channels[0] ?? 'email');
      const extras: string[] = [];
      if (pb?.notify_leasing) extras.push('Leasinggesellschaft informieren');
      if (pb?.escalate_to) extras.push(`Eskalation an ${pb.escalate_to}`);
      if (pb?.watch_installments) extras.push('Ratenüberwachung aktiv');

      newEvents.push({
        case_id: c.id,
        event_type: 'proposal',
        channel,
        stage_code: stage.code,
        subject: `Vorschlag: ${stage.label}${pb ? ` · ${pb.label}` : ''}`,
        body: `Fällig seit ${days} Tagen · offen ${overdue.toFixed(2)}. Maßnahme: ${stage.label} über ${channel} (Ton: ${pb?.tone ?? 'neutral'}, Sprache: ${pb?.language ?? 'de'}). Mahnkosten ${fee.toFixed(2)} · Zinsen ${interest.toFixed(2)}${extras.length ? ` · ${extras.join(' · ')}` : ''}.`,
        automated: true,
        meta: { day_offset: stage.day_offset, playbook: pb?.code, fee, interest, rate_pct: ratePct, country },
      });
      caseUpdates[caseUpdates.length - 1].next_action = `${stage.label}${pb ? ` (${pb.label})` : ''}`;
      caseUpdates[caseUpdates.length - 1].next_action_at = now;

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
    for (const u of caseUpdates) {
      const { id, ...rest } = u;
      await admin.from('collect_cases').update(rest).eq('id', id);
    }

    // 6) Gebrochene Zahlungsversprechen erkennen
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
        subject: 'Zahlungsversprechen nicht eingehalten',
        body: `Zugesagt ${p.amount} EUR zum ${p.promised_date}`,
        automated: true,
      });
      brokenPromises++;
    }

    // 7) Aufgaben erzeugen
    const { data: openTasks } = await admin
      .from('collect_tasks').select('case_id, task_type').eq('status', 'open').limit(5000);
    const taskKeys = new Set((openTasks ?? []).map((t: any) => `${t.case_id}|${t.task_type}`));
    const newTasks: any[] = [];
    const pushTask = (c: any, task_type: string, title: string, priority: number) => {
      const k = `${c.id ?? c}|${task_type}`;
      if (taskKeys.has(k)) return;
      taskKeys.add(k);
      newTasks.push({
        case_id: c.id ?? c, customer_id: c.customer_id ?? null, customer_name: c.customer_name ?? null,
        task_type, title, priority, status: 'open', due_date: today, source: 'engine',
      });
    };
    for (const p of promises ?? []) pushTask({ id: p.case_id }, 'promise_check', 'Gebrochenes Zahlungsversprechen prüfen', 1);
    for (const c of cases ?? []) {
      if (complaintCustomers.has(c.customer_name)) {
        pushTask(c, 'complaint', `${c.customer_name}: Reklamation klären (Mahnstopp aktiv)`, 1);
        continue;
      }
      if (c.paused_until && c.paused_until > today) continue;
      const d = Number(c.max_days_overdue ?? 0);
      const amt = Number(c.overdue_amount ?? 0);
      if (amt <= 0) continue;
      const pb = pickPlaybook(c);
      if (pb?.personal_call && d >= 7) pushTask(c, 'call', `${c.customer_name}: persönlicher Anruf (${pb.label})`, 1);
      else if (d >= 60 || amt >= 10000) pushTask(c, 'call', `${c.customer_name}: anrufen (${Math.round(amt)} € / ${d} T)`, 1);
      else if (d >= 30) pushTask(c, 'dunning', `${c.customer_name}: Mahnung versenden`, 2);
      if (d >= 90) pushTask(c, 'escalation', `${c.customer_name}: Inkasso/Anwalt prüfen`, 1);
      if (pb?.notify_leasing && d >= 14) pushTask(c, 'leasing', `${c.customer_name}: Leasinggesellschaft informieren`, 2);
      if (amt >= 50000) pushTask(c, 'approval', `${c.customer_name}: Freigabe erforderlich (${amt >= 100000 ? 'Geschäftsführung' : 'CFO'})`, 1);
    }
    for (let i = 0; i < newTasks.length; i += 500) {
      await admin.from('collect_tasks').insert(newTasks.slice(i, i + 500));
    }

    return json({
      ok: true, sync: syncRes, cases: cases?.length ?? 0, proposals: newEvents.length,
      blocks_set: newBlocks.length, complaint_holds: holds, tasks_created: newTasks.length,
      promises_broken: brokenPromises, ms: Date.now() - started,
    });
  } catch (e: any) {
    console.error('collect-engine failed:', e?.message ?? e);
    return json({ ok: false, error: e?.message ?? 'internal' }, 500);
  }
});
