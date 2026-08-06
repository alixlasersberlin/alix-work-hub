import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

type Json = Record<string, unknown>;

function json(body: Json, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** Berechnungsgrundlage aus Auftragswerten ableiten */
function basisAmount(basis: string, o: Record<string, any>) {
  const gross = Number(o.total_amount ?? o.finance_total_amount ?? 0);
  const net = gross > 0 ? gross / 1.19 : 0;
  const paid = Number(o.finance_paid_amount ?? 0);
  switch (basis) {
    case 'gross':
    case 'gross_after_discount':
      return gross;
    case 'paid_amount':
    case 'paid_installment':
      return paid;
    case 'margin':
      return net * 0.4;
    default:
      return net;
  }
}

function tierPercent(tiers: any[], count: number, fallback: number) {
  if (!Array.isArray(tiers) || !tiers.length) return fallback;
  for (const t of tiers) {
    const from = Number(t.from ?? 0);
    const to = t.to == null ? Infinity : Number(t.to);
    if (count >= from && count <= to) return Number(t.percent ?? fallback);
  }
  return fallback;
}

function computeAmount(rule: Record<string, any>, base: number, deviceCount: number) {
  const pct = Number(rule.percent_value ?? 0);
  const fixed = Number(rule.fixed_amount ?? 0);
  switch (rule.commission_type) {
    case 'fixed_per_device':
      return { percent: 0, amount: round2(fixed * deviceCount) };
    case 'tiered': {
      const p = tierPercent(rule.tiers, deviceCount, pct);
      return { percent: p, amount: round2((base * p) / 100) };
    }
    case 'combined':
      return { percent: pct, amount: round2(fixed * deviceCount + (base * pct) / 100) };
    default:
      return { percent: pct, amount: round2((base * pct) / 100) };
  }
}

/** Ampel-Voraussetzungen prüfen */
function evaluateConditions(o: Record<string, any>, rule: Record<string, any>) {
  const status = String(o.order_status ?? '').toLowerCase();
  const paid = Number(o.finance_paid_amount ?? 0);
  const total = Number(o.finance_total_amount ?? o.total_amount ?? 0);
  const paidPercent = total > 0 ? round2((paid / total) * 100) : 0;
  const delivered = ['geliefert', 'invoiced', 'delivered', 'closed', 'abgeschlossen'].includes(status);
  const confirmed = !['draft', 'entwurf', 'void', 'storniert', 'cancelled'].includes(status) && !!status;
  const cancelled = ['void', 'storniert', 'cancelled'].includes(status);

  const c: { condition_key: string; label: string; state: 'green' | 'yellow' | 'red'; detail?: string }[] = [];
  c.push({ condition_key: 'order_confirmed', label: 'Auftrag ist bestätigt', state: confirmed ? 'green' : 'yellow' });
  c.push({ condition_key: 'not_cancelled', label: 'Keine Stornierung', state: cancelled ? 'red' : 'green' });
  c.push({
    condition_key: 'deposit_received',
    label: 'Anzahlung eingegangen',
    state: o.deposit_ok || paid > 0 ? 'green' : 'yellow',
  });
  c.push({
    condition_key: 'fully_paid',
    label: 'Vollständige Zahlung eingegangen',
    state: total > 0 && paid >= total - 0.01 ? 'green' : 'yellow',
    detail: `${paidPercent} % bezahlt`,
  });
  c.push({ condition_key: 'delivered', label: 'Gerät ausgeliefert', state: delivered ? 'green' : 'yellow' });
  c.push({ condition_key: 'rule_valid', label: 'Provisionsregel gültig', state: rule?.is_active ? 'green' : 'red' });

  // Wirksamkeit gemäß Regel
  let effective = false;
  switch (rule.effective_event) {
    case 'order_created': effective = true; break;
    case 'order_confirmed': effective = confirmed; break;
    case 'deposit_received': effective = !!o.deposit_ok || paid > 0; break;
    case 'fully_paid': case 'after_full_payment': effective = total > 0 && paid >= total - 0.01; break;
    case 'delivered': case 'handover_confirmed': case 'commissioned': effective = delivered; break;
    case 'installment_received': effective = paid > 0; break;
    default: effective = delivered && paid > 0; break;
  }
  const extra = Array.isArray(rule.effective_conditions) ? rule.effective_conditions : [];
  for (const cond of extra) {
    if (cond === 'delivered') effective = effective && delivered;
    if (cond === 'order_confirmed') effective = effective && confirmed;
    if (typeof cond === 'string' && cond.startsWith('paid_min_')) {
      effective = effective && paidPercent >= Number(cond.replace('paid_min_', ''));
    }
  }
  if (cancelled) effective = false;
  return { conditions: c, effective, paidPercent, cancelled, delivered, paid, total };
}

function payoutDueDate(timing: string, from: Date, retentionDays = 0, minWait = 0): string {
  const d = new Date(from.getTime());
  d.setDate(d.getDate() + Number(retentionDays || 0) + Number(minWait || 0));
  const y = d.getFullYear(), m = d.getMonth();
  let out = d;
  switch (timing) {
    case 'month_end': out = new Date(y, m + 1, 0); break;
    case 'first_of_next_month': out = new Date(y, m + 1, 1); break;
    case 'fifteenth_of_next_month': out = new Date(y, m + 1, 15); break;
    case 'next_payroll': out = new Date(y, m + 1, 1); break;
    default: out = d;
  }
  return out.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'Nicht authentifiziert' }, 401);

  const supabase = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
  });

  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return json({ error: 'Nicht authentifiziert' }, 401);

  const { data: isAdmin } = await supabase.rpc('has_role', { check_role: 'Admin' });
  const { data: isSuper } = await supabase.rpc('has_role', { check_role: 'Super Admin' });
  if (!isAdmin && !isSuper) return json({ error: 'Keine Berechtigung' }, 403);

  let body: Json = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const action = String(body.action ?? '');

  const logAudit = async (entry: Json) =>
    await supabase.from('commission_audit_logs').insert({
      user_id: user.id,
      user_name: user.email,
      user_role: isSuper ? 'Super Admin' : 'Admin',
      ...entry,
    });

  try {
    if (action === 'scan_orders') {
      // 1. Regeln laden
      const { data: rules } = await supabase
        .from('commission_rules')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      if (!rules?.length) return json({ created: 0, skipped: 0, message: 'Keine aktive Provisionsregel vorhanden' });

      const { data: profiles } = await supabase.from('user_profiles').select('id, full_name, email');
      const byName = new Map<string, string>();
      (profiles ?? []).forEach((p) => { if (p.full_name) byName.set(p.full_name.trim().toLowerCase(), p.id); });

      const limit = Number(body.limit ?? 300);
      const { data: orders } = await supabase
        .from('orders')
        .select('id, order_number, customer_id, order_date, order_status, salesperson_name, total_amount, currency, source_system, accounting_region, finance_total_amount, finance_paid_amount, finance_payment_status, deposit_ok')
        .order('order_date', { ascending: false })
        .limit(limit);

      const { data: existing } = await supabase.from('commission_entries').select('order_id, employee_id');
      const existingKeys = new Set((existing ?? []).map((e) => `${e.order_id}|${e.employee_id}`));

      const { data: assignments } = await supabase.from('commission_assignments').select('*');
      const assignByOrder = new Map<string, any[]>();
      (assignments ?? []).forEach((a) => {
        const arr = assignByOrder.get(a.order_id) ?? [];
        arr.push(a); assignByOrder.set(a.order_id, arr);
      });

      const { data: customers } = await supabase.from('customers').select('id, customer_name').limit(5000);
      const custName = new Map((customers ?? []).map((c: any) => [c.id, c.customer_name]));

      let created = 0, unassigned = 0;
      for (const o of orders ?? []) {
        const assigned = assignByOrder.get(o.id) ?? [];
        let targets = assigned.map((a) => ({
          employee_id: a.employee_id,
          employee_role: a.employee_role,
          share: Number(a.share_percent ?? 100),
          rule_id: a.rule_id,
        }));
        if (!targets.length && o.salesperson_name) {
          const eid = byName.get(String(o.salesperson_name).trim().toLowerCase());
          if (eid) targets = [{ employee_id: eid, employee_role: 'verkaeufer', share: 100, rule_id: null }];
        }
        if (!targets.length) { unassigned++; continue; }

        const rule = rules.find((r) => r.id === targets[0].rule_id) ?? rules[0];
        const ev = evaluateConditions(o, rule);
        const base = round2(basisAmount(rule.basis, o));
        const gross = Number(o.total_amount ?? 0);

        for (const t of targets) {
          const key = `${o.id}|${t.employee_id}`;
          if (existingKeys.has(key)) continue;
          const calc = computeAmount(rule, base, 1);
          const amount = round2((calc.amount * t.share) / 100);
          const status = ev.cancelled ? 'blocked' : ev.effective ? (rule.approval_required ? 'pending_approval' : 'effective') : 'condition_open';
          const effectiveAt = ev.effective ? new Date().toISOString().slice(0, 10) : null;

          const { data: inserted, error } = await supabase.from('commission_entries').insert({
            order_id: o.id,
            order_number: o.order_number,
            customer_id: o.customer_id,
            customer_name: custName.get(o.customer_id) ?? null,
            employee_id: t.employee_id,
            employee_role: t.employee_role,
            rule_id: rule.id,
            rule_snapshot: rule,
            cost_center: rule.cost_center,
            account_number: rule.account_number,
            order_date: o.order_date ? String(o.order_date).slice(0, 10) : null,
            net_amount: round2(gross / 1.19),
            gross_amount: gross,
            basis: rule.basis,
            basis_amount: base,
            commission_type: rule.commission_type,
            commission_percent: calc.percent,
            commission_amount: amount,
            open_amount: amount,
            currency: o.currency ?? rule.currency ?? 'EUR',
            customer_payment_status: o.finance_payment_status,
            customer_paid_percent: ev.paidPercent,
            effective_at: effectiveAt,
            payout_due_date: ev.effective ? payoutDueDate(rule.payout_timing, new Date(), rule.payout_retention_days, rule.payout_min_wait_days) : null,
            status,
            calc_hash: `${o.id}:${t.employee_id}:${rule.id}`,
            created_by: user.id,
          }).select('id').maybeSingle();

          if (error || !inserted) continue;
          existingKeys.add(key);
          created++;
          await supabase.from('commission_conditions').insert(
            ev.conditions.map((c) => ({ ...c, entry_id: inserted.id })),
          );
        }
      }
      await logAudit({ action: 'Provision berechnet', object_type: 'scan', new_value: { created, unassigned } });
      return json({ created, unassigned });
    }

    if (action === 'recalc_entry') {
      const entryId = String(body.entry_id ?? '');
      const { data: entry } = await supabase.from('commission_entries').select('*').eq('id', entryId).maybeSingle();
      if (!entry) return json({ error: 'Provisionsposten nicht gefunden' }, 404);
      if (['paid', 'closed'].includes(entry.status)) return json({ error: 'Ausgezahlte Provision kann nicht neu berechnet werden' }, 400);

      const { data: o } = await supabase.from('orders').select('*').eq('id', entry.order_id).maybeSingle();
      const { data: rule } = await supabase.from('commission_rules').select('*').eq('id', entry.rule_id).maybeSingle();
      if (!o || !rule) return json({ error: 'Auftrag oder Regel fehlt' }, 404);

      const ev = evaluateConditions(o, rule);
      const base = round2(basisAmount(rule.basis, o));
      const calc = computeAmount(rule, base, entry.device_count ?? 1);
      const status = ev.cancelled ? 'blocked' : ev.effective
        ? (['approved', 'payout_scheduled', 'paid', 'partially_paid'].includes(entry.status) ? entry.status : (rule.approval_required ? 'pending_approval' : 'effective'))
        : 'condition_open';

      const locked = ['approved', 'payout_scheduled', 'paid', 'partially_paid'].includes(entry.status);
      const diff = round2(calc.amount - Number(entry.commission_amount ?? 0));
      if (locked && Math.abs(diff) > 0.009) {
        await supabase.from('commission_adjustments').insert({
          entry_id: entry.id, adjustment_type: 'correction', amount: diff,
          reason: 'Automatische Neuberechnung nach Auftragsänderung', created_by: user.id,
        });
      } else {
        await supabase.from('commission_entries').update({
          basis_amount: base,
          commission_percent: calc.percent,
          commission_amount: calc.amount,
          open_amount: round2(calc.amount - Number(entry.paid_amount ?? 0)),
          customer_paid_percent: ev.paidPercent,
          customer_payment_status: o.finance_payment_status,
          status,
          effective_at: ev.effective ? (entry.effective_at ?? new Date().toISOString().slice(0, 10)) : null,
          payout_due_date: ev.effective ? payoutDueDate(rule.payout_timing, new Date(), rule.payout_retention_days, rule.payout_min_wait_days) : null,
        }).eq('id', entry.id);
      }

      await supabase.from('commission_conditions').delete().eq('entry_id', entry.id);
      await supabase.from('commission_conditions').insert(ev.conditions.map((c) => ({ ...c, entry_id: entry.id })));
      await logAudit({ action: 'Provision berechnet', object_type: 'entry', object_id: entry.id, entry_id: entry.id, new_value: { amount: calc.amount } });
      return json({ ok: true, amount: calc.amount, adjustment: locked ? diff : 0 });
    }

    if (action === 'decide') {
      const entryIds: string[] = Array.isArray(body.entry_ids) ? body.entry_ids as string[] : [];
      const decision = String(body.decision ?? 'approve');
      const reason = body.reason ? String(body.reason) : null;
      if (!entryIds.length) return json({ error: 'Keine Provision ausgewählt' }, 400);
      if (decision === 'reject' && !reason) return json({ error: 'Begründung erforderlich' }, 400);

      const { data: settings } = await supabase.from('commission_settings').select('*').limit(1).maybeSingle();
      const threshold = Number(settings?.approval_threshold_amount ?? 5000);
      const fourEyes = settings?.four_eyes_enabled ?? true;

      const results: Json[] = [];
      for (const id of entryIds) {
        const { data: e } = await supabase.from('commission_entries').select('*').eq('id', id).maybeSingle();
        if (!e) continue;

        if (decision === 'approve') {
          const needsSuper = fourEyes && Number(e.commission_amount) >= threshold;
          if (needsSuper && !isSuper) {
            await supabase.from('commission_entries').update({ approval_state: 'admin_checked' }).eq('id', id);
            await supabase.from('commission_approvals').insert({ entry_id: id, step: 'admin', decision: 'checked', decided_by: user.id, decided_by_name: user.email });
            results.push({ id, status: 'admin_checked' });
            continue;
          }
          await supabase.from('commission_entries').update({
            status: 'approved', approval_state: 'approved', approved_by: user.id, approved_at: new Date().toISOString(),
          }).eq('id', id);
          await supabase.from('commission_approvals').insert({ entry_id: id, step: isSuper ? 'superadmin' : 'admin', decision: 'approved', reason, decided_by: user.id, decided_by_name: user.email });
        } else if (decision === 'reject') {
          await supabase.from('commission_entries').update({ status: 'blocked', approval_state: 'rejected', block_reason: reason }).eq('id', id);
          await supabase.from('commission_approvals').insert({ entry_id: id, step: 'admin', decision: 'rejected', reason, decided_by: user.id, decided_by_name: user.email });
        } else if (decision === 'block') {
          await supabase.from('commission_entries').update({ status: 'blocked', block_reason: reason }).eq('id', id);
        } else if (decision === 'schedule') {
          await supabase.from('commission_entries').update({ status: 'payout_scheduled' }).eq('id', id);
        }
        await logAudit({ action: `Provision ${decision}`, object_type: 'entry', object_id: id, entry_id: id, employee_id: e.employee_id, order_id: e.order_id, reason, old_value: { status: e.status } });
        await supabase.from('commission_notifications').insert({
          event_type: `commission_${decision}`, entry_id: id, recipient_id: e.employee_id,
          title: decision === 'approve' ? 'Provision freigegeben' : decision === 'reject' ? 'Provision abgelehnt' : 'Provision aktualisiert',
          message: `${e.entry_number} · ${e.order_number ?? ''}`,
        });
        results.push({ id, status: decision });
      }
      return json({ ok: true, results });
    }

    if (action === 'reverse') {
      const entryId = String(body.entry_id ?? '');
      const reasonCode = String(body.reason_code ?? 'storno');
      const reason = String(body.reason ?? '');
      const isReclaim = !!body.is_reclaim;
      const { data: e } = await supabase.from('commission_entries').select('*').eq('id', entryId).maybeSingle();
      if (!e) return json({ error: 'Provisionsposten nicht gefunden' }, 404);
      const amount = body.amount != null ? Number(body.amount) : Number(e.commission_amount);

      await supabase.from('commission_reversals').insert({
        entry_id: entryId, reversal_type: isReclaim ? 'reclaim' : 'cancellation',
        reason_code: reasonCode, reason, amount, is_reclaim: isReclaim, created_by: user.id,
      });
      if (isReclaim) {
        await supabase.from('commission_entries').insert({
          order_id: e.order_id, order_number: e.order_number, customer_id: e.customer_id, customer_name: e.customer_name,
          employee_id: e.employee_id, employee_role: e.employee_role, rule_id: e.rule_id, tenant_id: e.tenant_id,
          commission_type: e.commission_type, basis: e.basis, basis_amount: 0,
          commission_percent: 0, commission_amount: -Math.abs(amount), open_amount: -Math.abs(amount),
          currency: e.currency, status: 'reclaimed', parent_entry_id: e.id,
          notes: `Rückforderung zu ${e.entry_number}: ${reason}`, created_by: user.id,
        });
      }
      await supabase.from('commission_entries').update({ status: isReclaim ? 'reclaimed' : 'cancelled', block_reason: reason }).eq('id', entryId);
      await logAudit({ action: isReclaim ? 'Rückforderung erstellt' : 'Provision storniert', object_type: 'entry', object_id: entryId, entry_id: entryId, reason });
      return json({ ok: true });
    }

    if (action === 'register_payment') {
      const entryIds: string[] = Array.isArray(body.entry_ids) ? body.entry_ids as string[] : [];
      if (!entryIds.length) return json({ error: 'Keine Provisionsposten ausgewählt' }, 400);
      const { data: entries } = await supabase.from('commission_entries').select('*').in('id', entryIds);
      const valid = (entries ?? []).filter((e) => ['approved', 'payout_scheduled', 'partially_paid', 'reclaimed'].includes(e.status));
      if (!valid.length) return json({ error: 'Nur freigegebene Provisionen können ausgezahlt werden' }, 400);
      const employeeId = valid[0].employee_id;
      if (valid.some((e) => e.employee_id !== employeeId)) return json({ error: 'Auszahlung nur je Mitarbeiter möglich' }, 400);

      const total = round2(valid.reduce((s, e) => s + Number(e.open_amount ?? e.commission_amount), 0));
      const { data: payment, error } = await supabase.from('commission_payments').insert({
        payment_number: `PAY-${new Date().toISOString().slice(0, 10)}-${Math.floor(Math.random() * 9000 + 1000)}`,
        employee_id: employeeId,
        period_start: body.period_start ?? null,
        period_end: body.period_end ?? null,
        amount: total,
        currency: valid[0].currency ?? 'EUR',
        payment_date: body.payment_date ?? new Date().toISOString().slice(0, 10),
        payment_method: body.payment_method ?? 'bank_transfer',
        bank_account: body.bank_account ?? null,
        booking_reference: body.booking_reference ?? null,
        purpose: body.purpose ?? 'Provisionsauszahlung',
        tenant_id: body.tenant_id ?? null,
        cost_center: body.cost_center ?? null,
        note: body.note ?? null,
        created_by: user.id,
      }).select('*').maybeSingle();
      if (error || !payment) return json({ error: error?.message ?? 'Auszahlung fehlgeschlagen' }, 400);

      for (const e of valid) {
        const amt = round2(Number(e.open_amount ?? e.commission_amount));
        await supabase.from('commission_payment_items').insert({ payment_id: payment.id, entry_id: e.id, amount: amt });
        await supabase.from('commission_entries').update({
          paid_amount: round2(Number(e.paid_amount ?? 0) + amt),
          open_amount: 0,
          status: 'paid',
        }).eq('id', e.id);
      }
      await logAudit({ action: 'Auszahlung erfasst', object_type: 'payment', object_id: payment.id, employee_id: employeeId, new_value: { amount: total } });
      return json({ ok: true, payment });
    }

    if (action === 'create_statement') {
      const employeeId = String(body.employee_id ?? '');
      const start = String(body.period_start ?? '');
      const end = String(body.period_end ?? '');
      if (!employeeId || !start || !end) return json({ error: 'Mitarbeiter und Zeitraum erforderlich' }, 400);

      const { data: entries } = await supabase.from('commission_entries')
        .select('*')
        .eq('employee_id', employeeId)
        .gte('created_at', `${start}T00:00:00Z`)
        .lte('created_at', `${end}T23:59:59Z`);
      const list = entries ?? [];
      const total = round2(list.reduce((s, e) => s + Number(e.commission_amount), 0));
      const reclaims = round2(list.filter((e) => Number(e.commission_amount) < 0).reduce((s, e) => s + Number(e.commission_amount), 0));
      const alreadyPaid = round2(list.reduce((s, e) => s + Number(e.paid_amount ?? 0), 0));

      const { data: st, error } = await supabase.from('commission_statements').insert({
        statement_number: `ABR-${start.slice(0, 7)}-${Math.floor(Math.random() * 9000 + 1000)}`,
        employee_id: employeeId, period_start: start, period_end: end,
        total_amount: total, reclaims_amount: reclaims, already_paid_amount: alreadyPaid,
        payout_amount: round2(total - alreadyPaid),
        entry_ids: list.map((e) => e.id),
        status: 'draft', created_by: user.id,
      }).select('*').maybeSingle();
      if (error) return json({ error: error.message }, 400);
      await logAudit({ action: 'Abrechnung erzeugt', object_type: 'statement', object_id: st?.id, employee_id: employeeId });
      return json({ ok: true, statement: st });
    }

    return json({ error: `Unbekannte Aktion: ${action}` }, 400);
  } catch (err) {
    console.error('commission-engine error', err);
    return json({ error: err instanceof Error ? err.message : 'Unbekannter Fehler' }, 500);
  }
});
