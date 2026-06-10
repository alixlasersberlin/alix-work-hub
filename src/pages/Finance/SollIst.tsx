import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, PageLoading, DataCard } from '@/components/PageShell';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BUDGET_CATEGORIES, MONTH_NAMES, fmt, classifyTx, mapIncomingCategory } from './_controlling';

export default function FinanceSollIst() {
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [budget, setBudget] = useState<Record<string, number[]>>({});
  const [actual, setActual] = useState<Record<string, number[]>>({});
  const [afa, setAfa] = useState<number[]>(Array(12).fill(0));

  useEffect(() => {
    (async () => {
      setLoading(true);
      const s = `${year}-01-01`, e = `${year}-12-31`;
      const [b, t, ii, a] = await Promise.all([
        supabase.from('finance_budgets' as any).select('*').eq('fiscal_year', year),
        supabase.from('finance_transactions').select('amount, transaction_type, booking_date').gte('booking_date', s).lte('booking_date', e),
        supabase.from('finance_incoming_invoices').select('amount_net, amount_gross, invoice_date, description').gte('invoice_date', s).lte('invoice_date', e),
        supabase.from('finance_asset_depreciations').select('amount, period').gte('period', s).lte('period', e),
      ]);
      const bMap: Record<string, number[]> = {};
      for (const cat of BUDGET_CATEGORIES) bMap[cat] = Array(12).fill(0);
      for (const r of (b.data ?? []) as any[]) {
        if (!bMap[r.category]) bMap[r.category] = Array(12).fill(0);
        bMap[r.category][r.month - 1] = Number(r.planned_amount) || 0;
      }
      setBudget(bMap);

      const aMap: Record<string, number[]> = {};
      for (const cat of BUDGET_CATEGORIES) aMap[cat] = Array(12).fill(0);
      for (const r of t.data ?? []) {
        const c = classifyTx(r);
        if (!c) continue;
        const m = new Date(r.booking_date).getMonth();
        aMap[c][m] += Math.abs(Number(r.amount) || 0);
      }
      for (const r of (ii.data ?? []) as any[]) {
        const c = mapIncomingCategory(r.description);
        const m = new Date(r.invoice_date).getMonth();
        aMap[c][m] += Number(r.amount_net || r.amount_gross) || 0;
      }
      const afaArr = Array(12).fill(0);
      for (const r of (a.data ?? []) as any[]) {
        afaArr[new Date(r.period).getMonth()] += Number(r.amount) || 0;
      }
      aMap['AfA'] = afaArr;
      setActual(aMap);
      setAfa(afaArr);
      setLoading(false);
    })();
  }, [year]);

  if (loading) return <PageLoading />;

  function ampel(plan: number, ist: number) {
    if (plan === 0 && ist === 0) return 'bg-muted';
    const abw = plan === 0 ? 1 : Math.abs((ist - plan) / plan);
    if (abw < 0.1) return 'bg-green-500/15 text-green-500';
    if (abw < 0.2) return 'bg-amber-500/15 text-amber-500';
    return 'bg-red-500/15 text-red-500';
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Soll-Ist-Vergleich" subtitle={`Plan vs. Ist · ${year}`} />
      <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
        <SelectContent>{[year + 1, year, year - 1, year - 2].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
      </Select>

      {BUDGET_CATEGORIES.map(cat => {
        const plan = budget[cat] || Array(12).fill(0);
        const ist = actual[cat] || Array(12).fill(0);
        const planTotal = plan.reduce((a, b) => a + b, 0);
        const istTotal = ist.reduce((a, b) => a + b, 0);
        return (
          <DataCard key={cat} title={cat}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="px-3 py-2 text-left">Werte</th>
                    {MONTH_NAMES.map(m => <th key={m} className="px-2 py-2 text-right">{m}</th>)}
                    <th className="px-3 py-2 text-right font-bold">Jahr</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-border/40">
                    <td className="px-3 py-2 text-muted-foreground">Plan</td>
                    {plan.map((v, i) => <td key={i} className="px-2 py-2 text-right tabular-nums">{v ? fmt(v) : '–'}</td>)}
                    <td className="px-3 py-2 text-right font-bold tabular-nums">{fmt(planTotal)}</td>
                  </tr>
                  <tr className="border-t border-border/40">
                    <td className="px-3 py-2 text-muted-foreground">Ist</td>
                    {ist.map((v, i) => <td key={i} className="px-2 py-2 text-right tabular-nums">{v ? fmt(v) : '–'}</td>)}
                    <td className="px-3 py-2 text-right font-bold tabular-nums">{fmt(istTotal)}</td>
                  </tr>
                  <tr className="border-t border-border/40 bg-muted/20">
                    <td className="px-3 py-2 font-medium">Abw.</td>
                    {plan.map((p, i) => {
                      const diff = ist[i] - p;
                      return <td key={i} className={`px-2 py-2 text-right tabular-nums rounded ${ampel(p, ist[i])}`}>{diff ? fmt(diff) : '–'}</td>;
                    })}
                    <td className={`px-3 py-2 text-right font-bold tabular-nums ${ampel(planTotal, istTotal)}`}>{fmt(istTotal - planTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </DataCard>
        );
      })}
    </div>
  );
}
