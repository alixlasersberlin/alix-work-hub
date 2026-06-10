import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, PageLoading, DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Save } from 'lucide-react';
import { toast } from 'sonner';
import { BUDGET_CATEGORIES, MONTH_NAMES, fmt, classifyTx, mapIncomingCategory } from './_controlling';

type BudgetMap = Record<string, Record<number, number>>; // category -> month -> amount

export default function FinanceBudget() {
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<BudgetMap>({});
  const [dirty, setDirty] = useState(false);

  async function load() {
    setLoading(true);
    const { data: rows } = await supabase.from('finance_budgets' as any).select('*').eq('fiscal_year', year);
    const map: BudgetMap = {};
    for (const cat of BUDGET_CATEGORIES) map[cat] = {};
    for (const r of (rows ?? []) as any[]) {
      if (!map[r.category]) map[r.category] = {};
      map[r.category][r.month] = Number(r.planned_amount) || 0;
    }
    setData(map);
    setDirty(false);
    setLoading(false);
  }

  useEffect(() => { load(); }, [year]);

  function update(cat: string, month: number, value: string) {
    const n = Number(value.replace(',', '.')) || 0;
    setData(prev => ({ ...prev, [cat]: { ...prev[cat], [month]: n } }));
    setDirty(true);
  }

  async function save() {
    const rows: any[] = [];
    for (const cat of Object.keys(data)) {
      for (let m = 1; m <= 12; m++) {
        rows.push({ fiscal_year: year, month: m, category: cat, planned_amount: data[cat]?.[m] || 0 });
      }
    }
    const { error } = await supabase.from('finance_budgets' as any).upsert(rows, { onConflict: 'tenant_id,fiscal_year,month,category' });
    if (error) return toast.error(error.message);
    toast.success('Budget gespeichert');
    setDirty(false);
  }

  async function copyFromPriorYearActual() {
    const s = `${year - 1}-01-01`, e = `${year - 1}-12-31`;
    const [tx, ii] = await Promise.all([
      supabase.from('finance_transactions').select('amount, transaction_type, booking_date').gte('booking_date', s).lte('booking_date', e),
      supabase.from('finance_incoming_invoices').select('total_amount, net_amount, invoice_date, category').gte('invoice_date', s).lte('invoice_date', e),
    ]);
    const map: BudgetMap = {};
    for (const cat of BUDGET_CATEGORIES) map[cat] = {};
    for (const r of tx.data ?? []) {
      const cat = classifyTx(r);
      if (!cat) continue;
      const m = new Date(r.booking_date).getMonth() + 1;
      map[cat][m] = (map[cat][m] || 0) + Math.abs(Number(r.amount) || 0);
    }
    for (const r of ii.data ?? []) {
      const cat = mapIncomingCategory(r.category);
      const m = new Date(r.invoice_date).getMonth() + 1;
      map[cat][m] = (map[cat][m] || 0) + (Number(r.net_amount || r.total_amount) || 0);
    }
    setData(map);
    setDirty(true);
    toast.success('Vorjahres-Ist als Budget übernommen – noch nicht gespeichert');
  }

  const rowTotal = (cat: string) => Array.from({ length: 12 }, (_, i) => data[cat]?.[i + 1] || 0).reduce((a, b) => a + b, 0);

  if (loading) return <PageLoading />;

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Budgetplanung" subtitle={`Plan-Werte pro Kategorie und Monat · ${year}`} />

      <div className="flex flex-wrap items-center gap-3">
        <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>{[year + 1, year, year - 1, year - 2].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="outline" onClick={copyFromPriorYearActual}><Copy className="h-4 w-4 mr-2" />Aus Vorjahres-Ist übernehmen</Button>
        <Button onClick={save} disabled={!dirty}><Save className="h-4 w-4 mr-2" />Speichern</Button>
      </div>

      <DataCard title={`Budget ${year}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left">Kategorie</th>
                {MONTH_NAMES.map(m => <th key={m} className="px-2 py-2 text-right">{m}</th>)}
                <th className="px-3 py-2 text-right font-bold">Jahr</th>
              </tr>
            </thead>
            <tbody>
              {BUDGET_CATEGORIES.map(cat => (
                <tr key={cat} className="border-t border-border/40">
                  <td className="px-3 py-2 font-medium">{cat}</td>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <td key={m} className="px-1 py-1">
                      <Input
                        type="number"
                        value={data[cat]?.[m] || 0}
                        onChange={e => update(cat, m, e.target.value)}
                        className="h-8 text-right tabular-nums w-20"
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-bold tabular-nums">{fmt(rowTotal(cat))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataCard>
    </div>
  );
}
