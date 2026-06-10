import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, PageLoading, DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download } from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);

type Row = { label: string; values: number[]; total: number; emphasize?: boolean };

const INCOME_TYPES = ['Rechnung', 'Einnahme', 'Erlös', 'Erloes', 'Sale'];
const EXPENSE_TYPES = ['Eingangsrechnung', 'Ausgabe', 'Aufwand', 'Wareneinkauf'];
const DEPOSIT_TYPES = ['Anzahlung', 'Zahlung'];

function classify(tx: any): 'income' | 'expense' | 'deposit' | 'other' {
  const t = (tx.transaction_type || '').toLowerCase();
  if (INCOME_TYPES.some(x => t.includes(x.toLowerCase()))) return 'income';
  if (EXPENSE_TYPES.some(x => t.includes(x.toLowerCase()))) return 'expense';
  if (DEPOSIT_TYPES.some(x => t.includes(x.toLowerCase()))) return 'deposit';
  return 'other';
}

export default function FinanceBwa() {
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [tx, setTx] = useState<any[]>([]);
  const [txPrev, setTxPrev] = useState<any[]>([]);
  const [afa, setAfa] = useState<any[]>([]);
  const [incoming, setIncoming] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const start = `${year}-01-01`;
      const end = `${year}-12-31`;
      const startPrev = `${year - 1}-01-01`;
      const endPrev = `${year - 1}-12-31`;
      const [t, tp, a, ii] = await Promise.all([
        supabase.from('finance_transactions').select('amount, transaction_type, booking_date').gte('booking_date', start).lte('booking_date', end),
        supabase.from('finance_transactions').select('amount, transaction_type, booking_date').gte('booking_date', startPrev).lte('booking_date', endPrev),
        supabase.from('finance_asset_depreciations').select('amount, period').gte('period', start).lte('period', end),
        supabase.from('finance_incoming_invoices').select('total_amount, net_amount, invoice_date, category').gte('invoice_date', start).lte('invoice_date', end),
      ]);
      setTx(t.data ?? []);
      setTxPrev(tp.data ?? []);
      setAfa(a.data ?? []);
      setIncoming(ii.data ?? []);
      setLoading(false);
    })();
  }, [year]);

  const rows = useMemo(() => {
    const monthIncome = Array(12).fill(0);
    const monthExpense = Array(12).fill(0);
    const monthAfa = Array(12).fill(0);
    const monthIncomingByCat: Record<string, number[]> = {};

    for (const r of tx) {
      const m = new Date(r.booking_date).getMonth();
      const cls = classify(r);
      const amt = Math.abs(Number(r.amount) || 0);
      if (cls === 'income') monthIncome[m] += amt;
      else if (cls === 'expense') monthExpense[m] += amt;
    }
    for (const r of afa) {
      const m = new Date(r.period).getMonth();
      monthAfa[m] += Number(r.amount) || 0;
    }
    for (const r of incoming) {
      const m = new Date(r.invoice_date).getMonth();
      const cat = r.category || 'Sonstige Aufwendungen';
      if (!monthIncomingByCat[cat]) monthIncomingByCat[cat] = Array(12).fill(0);
      monthIncomingByCat[cat][m] += Number(r.net_amount || r.total_amount) || 0;
    }

    const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
    const sub = (a: number[], b: number[]) => a.map((v, i) => v - b[i]);

    const result: Row[] = [];
    result.push({ label: 'Umsatzerlöse', values: monthIncome, total: sum(monthIncome) });
    const wareneinsatz = monthIncomingByCat['Wareneinkauf'] || Array(12).fill(0);
    result.push({ label: 'Wareneinsatz', values: wareneinsatz, total: sum(wareneinsatz) });
    const rohertrag = sub(monthIncome, wareneinsatz);
    result.push({ label: 'Rohertrag', values: rohertrag, total: sum(rohertrag), emphasize: true });

    for (const [cat, arr] of Object.entries(monthIncomingByCat)) {
      if (cat === 'Wareneinkauf') continue;
      result.push({ label: cat, values: arr, total: sum(arr) });
    }
    if (monthExpense.some(x => x > 0)) {
      result.push({ label: 'Sonst. betriebliche Aufwendungen', values: monthExpense, total: sum(monthExpense) });
    }
    result.push({ label: 'Abschreibungen (AfA)', values: monthAfa, total: sum(monthAfa) });

    const totalExpenses = result.slice(1).reduce((acc, r) => acc.map((v, i) => v + r.values[i]), Array(12).fill(0) as number[]);
    const ergebnis = sub(monthIncome, totalExpenses);
    result.push({ label: 'Vorläufiges Ergebnis', values: ergebnis, total: sum(ergebnis), emphasize: true });

    return result;
  }, [tx, afa, incoming]);

  const prevTotal = useMemo(() => {
    let inc = 0, exp = 0;
    for (const r of txPrev) {
      const cls = classify(r);
      const amt = Math.abs(Number(r.amount) || 0);
      if (cls === 'income') inc += amt;
      else if (cls === 'expense') exp += amt;
    }
    return inc - exp;
  }, [txPrev]);

  function exportCsv() {
    const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez', 'Jahr'];
    const lines = [['Position', ...months].join(';')];
    for (const r of rows) {
      lines.push([r.label, ...r.values.map(v => v.toFixed(2).replace('.', ',')), r.total.toFixed(2).replace('.', ',')].join(';'));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BWA-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <PageLoading />;

  const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const ergebnis = rows[rows.length - 1].total;
  const years = [year + 1, year, year - 1, year - 2, year - 3];

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="BWA – Betriebswirtschaftliche Auswertung" subtitle={`Geschäftsjahr ${year}`} />

      <div className="flex items-center gap-3">
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />CSV Export</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DataCard title="Ergebnis YTD"><div className="text-2xl font-bold">{fmt(ergebnis)}</div></DataCard>
        <DataCard title="Vorjahres-Ergebnis"><div className="text-2xl font-bold">{fmt(prevTotal)}</div></DataCard>
        <DataCard title="Veränderung"><div className="text-2xl font-bold">{fmt(ergebnis - prevTotal)}</div></DataCard>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left">Position</th>
              {months.map(m => <th key={m} className="px-3 py-2 text-right">{m}</th>)}
              <th className="px-3 py-2 text-right font-bold">Jahr</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx} className={r.emphasize ? 'bg-primary/5 font-semibold border-t border-border' : 'border-t border-border/40'}>
                <td className="px-3 py-2">{r.label}</td>
                {r.values.map((v, i) => <td key={i} className="px-3 py-2 text-right tabular-nums">{v ? fmt(v) : '–'}</td>)}
                <td className="px-3 py-2 text-right tabular-nums font-bold">{fmt(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
