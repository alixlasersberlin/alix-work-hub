import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, PageLoading, DataCard } from '@/components/PageShell';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { fmt, MONTH_NAMES, classifyTx } from './_controlling';

export default function FinanceControlling() {
  const [loading, setLoading] = useState(true);
  const [tx, setTx] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [incoming, setIncoming] = useState<any[]>([]);
  const [bankLines, setBankLines] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const start = new Date(); start.setMonth(start.getMonth() - 11); start.setDate(1);
      const s = start.toISOString().slice(0, 10);
      const [t, a, ii, bl] = await Promise.all([
        supabase.from('finance_transactions').select('amount, transaction_type, booking_date').gte('booking_date', s),
        supabase.from('finance_accounts').select('current_balance, overdue_balance, last_payment_at'),
        supabase.from('finance_incoming_invoices').select('amount_gross, invoice_date, due_date, paid_at'),
        supabase.from('finance_bank_lines').select('amount, value_date'),
      ]);
      setTx(t.data ?? []);
      setAccounts(a.data ?? []);
      setIncoming(ii.data ?? []);
      setBankLines(bl.data ?? []);
      setLoading(false);
    })();
  }, []);

  const kpis = useMemo(() => {
    const ytd = tx.filter(r => classifyTx(r) === 'Umsatz').reduce((s, r) => s + Math.abs(Number(r.amount) || 0), 0);
    const aufw = tx.filter(r => classifyTx(r) === 'Sonstige Aufwendungen').reduce((s, r) => s + Math.abs(Number(r.amount) || 0), 0)
      + (incoming as any[]).reduce((s, r) => s + (Number(r.amount_gross) || 0), 0);
    const ergebnis = ytd - aufw;
    const margin = ytd ? (ergebnis / ytd) * 100 : 0;

    // DSO – avg days from invoice to payment via finance_accounts (proxy: overdue / (umsatz/365))
    const forderungen = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);
    const dso = ytd ? Math.round(forderungen / (ytd / 365)) : 0;

    // DPO
    const verbindlichkeiten = (incoming as any[]).filter(i => !i.paid_at).reduce((s, i) => s + Number(i.amount_gross || 0), 0);
    const dpo = aufw ? Math.round(verbindlichkeiten / (aufw / 365)) : 0;

    const bank = bankLines.reduce((s, l) => s + Number(l.amount || 0), 0);
    const workingCapital = forderungen + Math.max(bank, 0) - verbindlichkeiten;

    // Burn rate: avg monthly negative net cashflow
    const months: Record<string, number> = {};
    for (const r of bankLines) {
      const k = (r.value_date || '').slice(0, 7);
      if (!k) continue;
      months[k] = (months[k] || 0) + Number(r.amount || 0);
    }
    const negative = Object.values(months).filter(v => v < 0);
    const burn = negative.length ? Math.abs(negative.reduce((a, b) => a + b, 0) / negative.length) : 0;
    const runway = burn ? Math.max(bank, 0) / burn : Infinity;

    return { ytd, aufw, ergebnis, margin, dso, dpo, workingCapital, burn, runway, bank, forderungen, verbindlichkeiten };
  }, [tx, accounts, incoming, bankLines]);

  const trend = useMemo(() => {
    const map: Record<string, { month: string; umsatz: number; aufwand: number; ergebnis: number }> = {};
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const k = d.toISOString().slice(0, 7);
      map[k] = { month: `${MONTH_NAMES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, umsatz: 0, aufwand: 0, ergebnis: 0 };
    }
    for (const r of tx) {
      const k = (r.booking_date || '').slice(0, 7);
      if (!map[k]) continue;
      const c = classifyTx(r);
      const v = Math.abs(Number(r.amount) || 0);
      if (c === 'Umsatz') map[k].umsatz += v;
      else if (c === 'Sonstige Aufwendungen') map[k].aufwand += v;
    }
    for (const r of incoming as any[]) {
      const k = (r.invoice_date || '').slice(0, 7);
      if (!map[k]) continue;
      map[k].aufwand += Number(r.amount_gross) || 0;
    }
    return Object.values(map).map(x => ({ ...x, ergebnis: x.umsatz - x.aufwand }));
  }, [tx, incoming]);

  if (loading) return <PageLoading />;

  const Tile = ({ title, value, hint }: { title: string; value: string; hint?: string }) => (
    <DataCard title={title}>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </DataCard>
  );

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Controlling-Cockpit" subtitle="Management-KPIs (12 Monate rollierend)" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Tile title="Umsatzrentabilität" value={`${kpis.margin.toFixed(1)} %`} hint={`Ergebnis ${fmt(kpis.ergebnis)} / Umsatz ${fmt(kpis.ytd)}`} />
        <Tile title="DSO – Forderungsdauer" value={`${kpis.dso} Tage`} hint={`Forderungen ${fmt(kpis.forderungen)}`} />
        <Tile title="DPO – Zahlungsdauer" value={`${kpis.dpo} Tage`} hint={`Verbindl. ${fmt(kpis.verbindlichkeiten)}`} />
        <Tile title="Working Capital" value={fmt(kpis.workingCapital)} hint={`Bank ${fmt(kpis.bank)}`} />
        <Tile title="Burn Rate (ø/Monat)" value={fmt(kpis.burn)} />
        <Tile title="Runway" value={isFinite(kpis.runway) ? `${kpis.runway.toFixed(1)} Mon.` : '∞'} />
        <Tile title="Umsatz YTD" value={fmt(kpis.ytd)} />
        <Tile title="Aufwand YTD" value={fmt(kpis.aufw)} />
      </div>

      <DataCard title="Trend 12 Monate – Umsatz, Aufwand, Ergebnis">
        <div className="h-80">
          <ResponsiveContainer>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(v: any) => fmt(Number(v))} />
              <Line type="monotone" dataKey="umsatz" stroke="hsl(var(--primary))" strokeWidth={2} name="Umsatz" />
              <Line type="monotone" dataKey="aufwand" stroke="hsl(var(--destructive))" strokeWidth={2} name="Aufwand" />
              <Line type="monotone" dataKey="ergebnis" stroke="hsl(var(--accent))" strokeWidth={2} name="Ergebnis" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </DataCard>
    </div>
  );
}
