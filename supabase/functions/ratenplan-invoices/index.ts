// ALIX Ratenplan – monatliche Rechnungserzeugung ab Lieferdatum
// Erzeugt fuer jeden Vertrag mit Lieferdatum die Monatsraten (erste Rate = 1. des
// Folgemonats nach Lieferung), rueckwirkend bis heute und fuer kuenftige Faelligkeiten.
// Aktionen: preview (Vorschau, schreibt nichts), generate (schreibt fehlende Raten)
// Aufruf: per angemeldetem Admin/Super Admin ODER per Cron mit x-cron-secret.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** 1. Tag des Folgemonats nach dem Lieferdatum */
function firstOfNextMonth(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)));
}

function addMonths(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)));
}

/** Monatsschritt je nach Frequenz des Vertrags */
function stepMonths(freq: string | null, repeat: number | null): number {
  const f = (freq ?? 'months').toLowerCase();
  const r = Math.max(1, Number(repeat ?? 1));
  if (f.startsWith('year')) return 12 * r;
  if (f.startsWith('week')) return 1; // wochenweise wird auf Monat gerundet
  if (f.startsWith('day')) return 1;
  return r;
}

type Profile = {
  id: string; reference_number: string | null; recurrence_name: string | null;
  customer_name: string | null; company_name: string | null; status: string | null;
  start_date: string | null; end_date: string | null; next_invoice_date: string | null;
  last_sent_date: string | null; total: number | null; currency: string | null;
  recurrence_frequency: string | null; repeat_every: number | null;
  delivery_date: string | null; accounting_region: string | null; tenant_id: string | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = Deno.env.get('SUPABASE_URL')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const cronSecret = Deno.env.get('RATENPLAN_CRON_SECRET') ?? '';

  const body = await req.json().catch(() => ({} as any));
  const isCron = body?.source === 'cron' &&
    !!cronSecret && req.headers.get('x-cron-secret') === cronSecret;

  let uid: string | null = null;
  if (!isCron) {
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    uid = userData?.user?.id ?? null;
    if (!uid) return json(401, { error: 'unauthorized' });
    const { data: isAdmin } = await userClient.rpc('has_role', { check_role: 'Admin' });
    const { data: isSuper } = await userClient.rpc('has_role', { check_role: 'Super Admin' });
    if (!isAdmin && !isSuper) return json(403, { error: 'forbidden' });
  }

  const svc = createClient(url, service);
  const action = String(body?.action ?? 'preview');
  if (action !== 'preview' && action !== 'generate') return json(400, { error: 'unknown_action' });

  const profileIds: string[] = Array.isArray(body?.profile_ids)
    ? body.profile_ids.filter((x: unknown) => typeof x === 'string').slice(0, 200)
    : [];
  const region = body?.region === 'CH' ? 'CH' : 'EU';
  const horizonMonths = Math.min(Number(body?.horizon_months ?? 0), 36); // kuenftige Raten im Voraus
  const limit = Math.min(Number(body?.limit ?? 500), 2000);

  try {
    let pq: any = svc
      .from('zoho_recurring_profiles')
      .select('id, reference_number, recurrence_name, customer_name, company_name, status, start_date, end_date, next_invoice_date, last_sent_date, total, currency, recurrence_frequency, repeat_every, delivery_date, accounting_region, tenant_id')
      .not('delivery_date', 'is', null)
      // Beendete Verträge (RATEN ENDE LEGAL) erzeugen keine Raten mehr
      .neq('status', 'legal_ended')
      .limit(limit);
    if (profileIds.length) pq = pq.in('id', profileIds);
    else pq = pq.eq('accounting_region', region);

    const { data: profiles, error: pErr } = await pq;
    if (pErr) throw pErr;
    const list = (profiles ?? []) as Profile[];
    if (!list.length) return json(200, { stats: { profiles: 0, created: 0, existing: 0, planned: 0 }, items: [] });

    const { data: existingRows } = await svc
      .from('ratenplan_generated_invoices')
      .select('profile_id, invoice_date')
      .in('profile_id', list.map((p) => p.id));
    const existing = new Set((existingRows ?? []).map((r: any) => `${r.profile_id}|${r.invoice_date}`));

    const today = iso(new Date());
    const horizonEnd = addMonths(today.slice(0, 8) + '01', horizonMonths);

    const items: any[] = [];
    let planned = 0, already = 0;

    for (const p of list) {
      if (!p.delivery_date) continue;
      const step = stepMonths(p.recurrence_frequency, p.repeat_every);
      const first = firstOfNextMonth(p.delivery_date);
      const amount = Number(p.total ?? 0);

      // Ende: Vertragsende, sonst heute (+ Horizont)
      const stop = p.end_date && p.end_date > horizonEnd ? p.end_date
        : (horizonMonths > 0 ? horizonEnd : today);

      let date = first;
      let no = 0;
      const guard = 500;
      while (date <= stop && no < guard) {
        no++;
        const key = `${p.id}|${date}`;
        if (existing.has(key)) {
          already++;
        } else {
          planned++;
          items.push({
            profile_id: p.id,
            reference_number: p.reference_number,
            customer_name: p.company_name || p.customer_name,
            installment_no: no,
            invoice_date: date,
            due_date: date,
            amount,
            currency: p.currency ?? 'EUR',
            status: (p.status ?? '').toLowerCase() === 'pruefung_hold' ? 'zurueckgehalten' : 'offen',
            origin: isCron ? 'cron' : 'manuell',
            delivery_date: p.delivery_date,
            accounting_region: (p.accounting_region ?? 'EU'),
            tenant_id: p.tenant_id,
            created_by: uid,
          });
        }
        date = addMonths(date, step);
      }
      // Gesamtanzahl je Vertrag nachtragen
      for (const it of items) if (it.profile_id === p.id) it.installment_total = no;
    }

    if (action === 'preview') {
      return json(200, {
        preview: true,
        stats: { profiles: list.length, planned, existing: already, created: 0 },
        items: items.slice(0, 1000),
      });
    }

    // ---- generate ----
    const { data: run, error: rErr } = await svc
      .from('ratenplan_invoice_runs')
      .insert({
        mode: isCron ? 'cron' : 'apply',
        status: 'running',
        created_by: uid,
        scope: { region, profile_ids: profileIds, horizon_months: horizonMonths },
      })
      .select('id').single();
    if (rErr) throw rErr;
    const runId = run.id as string;

    let created = 0;
    const errors: string[] = [];
    for (let i = 0; i < items.length; i += 200) {
      const chunk = items.slice(i, i + 200).map((it) => ({ ...it, run_id: runId }));
      const { error, count } = await svc
        .from('ratenplan_generated_invoices')
        .upsert(chunk, { onConflict: 'profile_id,invoice_date', ignoreDuplicates: true, count: 'exact' });
      if (error) errors.push(error.message);
      else created += count ?? chunk.length;
    }

    const stats = { profiles: list.length, planned, existing: already, created, errors: errors.slice(0, 5) };
    await svc.from('ratenplan_invoice_runs').update({
      status: errors.length && !created ? 'failed' : 'completed',
      stats, finished_at: new Date().toISOString(),
      error: errors.length ? errors.slice(0, 3).join(' | ') : null,
    }).eq('id', runId);

    await svc.from('finance_audit_trail').insert({
      module: 'ratenplan_sync',
      entity_table: 'ratenplan_generated_invoices',
      entity_id: runId,
      action: 'insert',
      new_data: stats,
      user_id: uid,
      accounting_region: region,
    });

    return json(200, { run_id: runId, stats, items: items.slice(0, 1000) });
  } catch (e) {
    console.error('ratenplan-invoices error', e);
    return json(500, { error: String((e as Error)?.message ?? e) });
  }
});
