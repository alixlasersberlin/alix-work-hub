// ALIX COLLECT – Analytics
// Berechnet Customer Health Score (0-100), passt Kreditlimits per Regel-KI an,
// bewertet Verkäufer nach Zahlungsqualität und erstellt die Liquiditätsprognose.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(n)));
const gradeFor = (s: number) => (s >= 85 ? 'A' : s >= 70 ? 'B' : s >= 55 ? 'C' : s >= 40 ? 'D' : 'E');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const started = Date.now();
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    // Datenbasis laden
    const [{ data: cases }, { data: customers }, { data: limits }] = await Promise.all([
      admin.from('collect_cases').select('id, customer_id, customer_name, open_amount, overdue_amount, max_days_overdue, risk_score, pay_probability_pct, status, seller_name').limit(3000),
      admin.from('customers').select('id, company_name, created_at').limit(5000),
      admin.from('collect_credit_limits').select('*').limit(2000),
    ]);

    // Rechnungen (paginiert) für Umsatz, Zahlungsverhalten, Bestellhäufigkeit
    const invoices: any[] = [];
    for (let page = 0; page < 20; page++) {
      const { data } = await admin.from('zoho_invoices')
        .select('customer_id, customer_name, total, balance, status, invoice_date, due_date, last_payment_date')
        .range(page * 1000, page * 1000 + 999);
      if (!data?.length) break;
      invoices.push(...data);
      if (data.length < 1000) break;
    }

    // Rücklastschriften & Tickets
    const [{ data: returns }, { data: tickets }] = await Promise.all([
      admin.from('bank_return_debits').select('customer_id, amount').limit(3000),
      admin.from('tickets').select('customer_name, status, category').limit(5000),
    ]);

    // Aggregation je Kunde (Schlüssel: customer_id oder Name)
    type Agg = {
      id: string | null; name: string; revenue: number; invoices: number; open: number; overdue: number;
      maxDays: number; paidOnTime: number; paidLate: number; returns: number; tickets: number; complaints: number;
      firstInvoice: string | null; lastInvoice: string | null; created: string | null;
    };
    const agg = new Map<string, Agg>();
    const keyOf = (id: any, name: any) => String(id ?? name ?? '').trim();
    const ensure = (id: any, name: any): Agg => {
      const k = keyOf(id, name);
      if (!agg.has(k)) agg.set(k, { id: id ?? null, name: name ?? '—', revenue: 0, invoices: 0, open: 0, overdue: 0, maxDays: 0, paidOnTime: 0, paidLate: 0, returns: 0, tickets: 0, complaints: 0, firstInvoice: null, lastInvoice: null, created: null });
      return agg.get(k)!;
    };

    for (const inv of invoices) {
      const a = ensure(inv.customer_id, inv.customer_name);
      a.revenue += Number(inv.total ?? 0);
      a.invoices += 1;
      a.open += Number(inv.balance ?? 0);
      if (inv.invoice_date) {
        if (!a.firstInvoice || inv.invoice_date < a.firstInvoice) a.firstInvoice = inv.invoice_date;
        if (!a.lastInvoice || inv.invoice_date > a.lastInvoice) a.lastInvoice = inv.invoice_date;
      }
      if (inv.last_payment_date && inv.due_date) {
        if (inv.last_payment_date <= inv.due_date) a.paidOnTime += 1; else a.paidLate += 1;
      }
    }
    for (const c of cases ?? []) {
      const a = ensure(c.customer_id, c.customer_name);
      a.overdue += Number(c.overdue_amount ?? 0);
      a.maxDays = Math.max(a.maxDays, Number(c.max_days_overdue ?? 0));
    }
    for (const r of returns ?? []) {
      if (!r.customer_id) continue;
      const k = keyOf(r.customer_id, null);
      if (agg.has(k)) agg.get(k)!.returns += 1;
    }
    for (const t of tickets ?? []) {
      const k = keyOf(null, t.customer_name);
      if (!agg.has(k)) continue;
      const a = agg.get(k)!;
      a.tickets += 1;
      if (String(t.category ?? '').toLowerCase().includes('rekla')) a.complaints += 1;
    }
    for (const cu of customers ?? []) {
      const k = keyOf(cu.id, cu.company_name);
      if (agg.has(k)) agg.get(k)!.created = cu.created_at;
      else { const k2 = keyOf(null, cu.company_name); if (agg.has(k2)) agg.get(k2)!.created = cu.created_at; }
    }

    // ---- 23) Health Score ----
    const maxRevenue = Math.max(1, ...Array.from(agg.values()).map((a) => a.revenue));
    const healthRows: any[] = [];
    const scoreByKey = new Map<string, number>();

    for (const [k, a] of agg) {
      if (!a.name || a.invoices === 0) continue;
      const revenue_score = clamp((a.revenue / maxRevenue) * 100);
      const paidTotal = a.paidOnTime + a.paidLate;
      const response_score = paidTotal ? clamp((a.paidOnTime / paidTotal) * 100) : 60;
      const dunning_score = clamp(100 - Math.min(100, a.maxDays));
      const return_debit_score = clamp(100 - a.returns * 25);
      const complaint_score = clamp(100 - a.complaints * 20);
      const ticket_score = clamp(100 - Math.max(0, a.tickets - 3) * 8);
      const service_score = clamp(100 - Math.max(0, a.tickets - 5) * 10);
      const order_frequency_score = clamp(Math.min(100, a.invoices * 8));
      const tenureMonths = a.firstInvoice ? Math.max(0, (today.getTime() - new Date(a.firstInvoice).getTime()) / (1000 * 60 * 60 * 24 * 30)) : 0;
      const tenure_score = clamp(Math.min(100, tenureMonths * 3));
      const credit_score = clamp(100 - (a.overdue > 0 ? Math.min(60, (a.overdue / Math.max(1, a.revenue)) * 200) : 0));
      const leasing_score = 70;
      const warranty_score = clamp(100 - a.complaints * 10);

      const score = clamp(
        revenue_score * 0.12 + response_score * 0.16 + dunning_score * 0.16 + return_debit_score * 0.10 +
        complaint_score * 0.08 + ticket_score * 0.05 + service_score * 0.05 + order_frequency_score * 0.08 +
        tenure_score * 0.06 + credit_score * 0.10 + leasing_score * 0.02 + warranty_score * 0.02,
      );
      scoreByKey.set(k, score);

      healthRows.push({
        customer_id: a.id, customer_name: a.name, score, grade: gradeFor(score),
        revenue_score, complaint_score, service_score, return_debit_score, dunning_score,
        ticket_score, response_score, leasing_score, warranty_score, order_frequency_score,
        credit_score, tenure_score,
        components: { revenue: a.revenue, invoices: a.invoices, overdue: a.overdue, max_days: a.maxDays, returns: a.returns, tickets: a.tickets, complaints: a.complaints, tenure_months: Math.round(tenureMonths) },
        computed_at: new Date().toISOString(),
      });
    }

    let healthSaved = 0;
    for (let i = 0; i < healthRows.length; i += 300) {
      const chunk = healthRows.slice(i, i + 300);
      const withId = chunk.filter((r) => r.customer_id);
      const withoutId = chunk.filter((r) => !r.customer_id);
      if (withId.length) {
        const { error } = await admin.from('collect_health_scores').upsert(withId, { onConflict: 'customer_id' });
        if (!error) healthSaved += withId.length;
      }
      for (const r of withoutId) {
        const { data: ex } = await admin.from('collect_health_scores').select('id').is('customer_id', null).eq('customer_name', r.customer_name).maybeSingle();
        if (ex?.id) await admin.from('collect_health_scores').update(r).eq('id', ex.id);
        else await admin.from('collect_health_scores').insert(r);
        healthSaved++;
      }
    }

    // Score an die Fälle spiegeln
    for (const c of cases ?? []) {
      const s = scoreByKey.get(keyOf(c.customer_id, c.customer_name));
      if (s == null || s === c.health_score) continue;
      await admin.from('collect_cases').update({ health_score: s }).eq('id', c.id);
    }

    // ---- 24) Credit Limit AI ----
    let limitsAdjusted = 0;
    for (const l of limits ?? []) {
      const k = keyOf(l.customer_id, l.customer_name);
      const a = agg.get(k);
      const score = scoreByKey.get(k);
      if (!a || score == null || l.unlimited) continue;
      const current = Number(l.credit_limit ?? 0);
      let target = current;
      let reason = '';
      if (a.returns >= 3) { target = Math.min(current, 2000); reason = `${a.returns} Rücklastschriften → Limit reduziert`; }
      else if (score >= 85 && a.maxDays <= 5 && a.paidOnTime >= 10) { target = Math.round(Math.max(current * 1.5, a.revenue * 0.25)); reason = 'Sehr gutes Zahlungsverhalten → Limit erhöht'; }
      else if (score >= 70 && a.maxDays <= 14) { target = Math.round(Math.max(current, a.revenue * 0.15)); reason = 'Stabile Zahlungshistorie → Limit angepasst'; }
      else if (score < 45 || a.maxDays >= 60) { target = Math.round(Math.max(1000, current * 0.5)); reason = 'Hohes Ausfallrisiko → Limit reduziert'; }
      target = Math.max(0, Math.round(target / 500) * 500);
      const light = target <= 0 ? 'rot' : a.open / Math.max(1, target) >= 1 ? 'rot' : a.open / Math.max(1, target) >= 0.8 ? 'gelb' : 'gruen';
      if (target === current && light === l.traffic_light) continue;
      await admin.from('collect_credit_limits').update({
        credit_limit: target, used_amount: a.open, traffic_light: light, rating_class: gradeFor(score),
        note: `${reason} (Score ${score}, ${new Date().toLocaleDateString('de-DE')})`, updated_at: new Date().toISOString(),
      }).eq('id', l.id);
      limitsAdjusted++;
    }

    // ---- 30) Verkäuferbewertung ----
    const sellers = new Map<string, { invoiced: number; overdue: number; days: number[]; customers: Set<string> }>();
    for (const c of cases ?? []) {
      const s = (c.seller_name ?? '').trim();
      if (!s) continue;
      if (!sellers.has(s)) sellers.set(s, { invoiced: 0, overdue: 0, days: [], customers: new Set() });
      const e = sellers.get(s)!;
      e.invoiced += Number(c.open_amount ?? 0);
      e.overdue += Number(c.overdue_amount ?? 0);
      e.days.push(Number(c.max_days_overdue ?? 0));
      e.customers.add(c.customer_name ?? '');
    }
    let sellerRows = 0;
    for (const [name, e] of sellers) {
      const quality = e.invoiced > 0 ? clamp(100 - (e.overdue / e.invoiced) * 100) : 100;
      const avgDays = e.days.length ? e.days.reduce((a, b) => a + b, 0) / e.days.length : 0;
      const { error } = await admin.from('collect_seller_scores').upsert({
        seller_name: name, period: 'all', payment_quality_pct: quality,
        customers_count: e.customers.size, invoiced_amount: e.invoiced, overdue_amount: e.overdue,
        avg_days_overdue: Math.round(avgDays), computed_at: new Date().toISOString(),
      }, { onConflict: 'seller_name,period' });
      if (!error) sellerRows++;
    }

    // ---- 42) Liquiditätsprognose ----
    for (const horizon of [7, 30, 90]) {
      let secure = 0, probable = 0, uncertain = 0, loss = 0;
      const until = new Date(today.getTime() + horizon * 86400000).toISOString().slice(0, 10);
      for (const inv of invoices) {
        const bal = Number(inv.balance ?? 0);
        if (bal <= 0) continue;
        if (!inv.due_date || inv.due_date > until) continue;
        const k = keyOf(inv.customer_id, inv.customer_name);
        const score = scoreByKey.get(k) ?? 50;
        if (score >= 80) secure += bal;
        else if (score >= 60) probable += bal;
        else if (score >= 40) uncertain += bal;
        else { uncertain += bal * 0.5; loss += bal * 0.5; }
      }
      await admin.from('collect_liquidity_forecast').upsert({
        forecast_date: todayStr, horizon_days: horizon,
        secure_amount: Math.round(secure), probable_amount: Math.round(probable),
        uncertain_amount: Math.round(uncertain), expected_loss: Math.round(loss),
      }, { onConflict: 'forecast_date,horizon_days' });
    }

    return json({ ok: true, customers: agg.size, health_scores: healthSaved, limits_adjusted: limitsAdjusted, sellers: sellerRows, ms: Date.now() - started });
  } catch (e: any) {
    console.error('collect-analytics failed:', e?.message ?? e);
    return json({ ok: false, error: e?.message ?? 'internal' }, 500);
  }
});
