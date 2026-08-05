import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, RefreshCw, FileSpreadsheet, FileText, TrendingDown } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';
import { useAccountingRegion } from '@/contexts/AccountingRegionContext';

type Row = {
  key: string;
  label: string;
  payments: number;      // erfolgreiche Lastschriften/Zahlungseingänge
  returns: number;       // Rücklastschriften
  returnAmount: number;
  fees: number;
  quote: number;         // in %
};

const money = (n: number) => Number(n || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
const pct = (n: number) => `${Number(n || 0).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-');
  return `${['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'][Number(m) - 1]} ${y}`;
};

const firstOfYear = () => `${new Date().getFullYear()}-01-01`;
const today = () => new Date().toISOString().slice(0, 10);

export default function Ruecklastschriftquote() {
  const { region } = useAccountingRegion();
  const [from, setFrom] = useState(firstOfYear());
  const [to, setTo] = useState(today());
  const [search, setSearch] = useState('');
  const [minReturns, setMinReturns] = useState(1);
  const [loading, setLoading] = useState(false);
  const [months, setMonths] = useState<Row[]>([]);
  const [customers, setCustomers] = useState<Row[]>([]);
  const [totals, setTotals] = useState<Row | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: rds, error: e1 }, { data: txs, error: e2 }] = await Promise.all([
        supabase.from('bank_return_debits' as any)
          .select('id, customer_id, booking_date, value_date, return_debit_amount, bank_fee, customer_fee, additional_costs, status')
          .eq('accounting_area', region)
          .gte('booking_date', from).lte('booking_date', to)
          .neq('status', 'storniert')
          .limit(5000),
        supabase.from('bank_transactions' as any)
          .select('id, booking_date, amount, matched_customer_id, is_duplicate')
          .eq('accounting_area', region)
          .gte('booking_date', from).lte('booking_date', to)
          .gt('amount', 0)
          .limit(10000),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;

      const returns = (rds ?? []) as any[];
      const payments = ((txs ?? []) as any[]).filter(t => !t.is_duplicate);

      // Kundennamen nachladen
      const custIds = Array.from(new Set([
        ...returns.map(r => r.customer_id),
        ...payments.map(p => p.matched_customer_id),
      ].filter(Boolean))) as string[];
      const nameMap = new Map<string, string>();
      for (let i = 0; i < custIds.length; i += 200) {
        const { data } = await supabase.from('customers')
          .select('id, company_name, contact_name, external_customer_id').in('id', custIds.slice(i, i + 200));
        (data ?? []).forEach((c: any) => nameMap.set(
          c.id,
          [(c.company_name || c.contact_name || 'Unbekannt'), c.external_customer_id].filter(Boolean).join(' · '),
        ));
      }

      const mk = (): Row => ({ key: '', label: '', payments: 0, returns: 0, returnAmount: 0, fees: 0, quote: 0 });
      const byMonth = new Map<string, Row>();
      const byCust = new Map<string, Row>();
      const total = mk();

      const bump = (map: Map<string, Row>, key: string, label: string) => {
        let r = map.get(key);
        if (!r) { r = { ...mk(), key, label }; map.set(key, r); }
        return r;
      };

      for (const p of payments) {
        const ym = String(p.booking_date ?? '').slice(0, 7);
        if (ym) bump(byMonth, ym, monthLabel(ym)).payments++;
        const cid = p.matched_customer_id;
        if (cid) bump(byCust, cid, nameMap.get(cid) ?? 'Unbekannt').payments++;
        total.payments++;
      }
      for (const r of returns) {
        const amount = Number(r.return_debit_amount || 0);
        const fee = Number(r.bank_fee || 0) + Number(r.additional_costs || 0) + Number(r.customer_fee || 0);
        const ym = String(r.booking_date ?? r.value_date ?? '').slice(0, 7);
        if (ym) {
          const m = bump(byMonth, ym, monthLabel(ym));
          m.returns++; m.returnAmount += amount; m.fees += fee;
        }
        const cid = r.customer_id;
        if (cid) {
          const c = bump(byCust, cid, nameMap.get(cid) ?? 'Unbekannt');
          c.returns++; c.returnAmount += amount; c.fees += fee;
        }
        total.returns++; total.returnAmount += amount; total.fees += fee;
      }

      const quote = (r: Row) => { const base = r.payments + r.returns; r.quote = base ? (r.returns / base) * 100 : 0; return r; };
      setMonths(Array.from(byMonth.values()).map(quote).sort((a, b) => a.key.localeCompare(b.key)));
      setCustomers(Array.from(byCust.values()).map(quote).sort((a, b) => b.quote - a.quote || b.returns - a.returns));
      setTotals(quote({ ...total, key: 'total', label: 'Gesamt' }));
    } catch (e: any) {
      toast.error(e.message);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [region]);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter(c => c.returns >= minReturns && (!q || c.label.toLowerCase().includes(q)));
  }, [customers, search, minReturns]);

  const exportCsv = () => {
    const sep = ';';
    const head = ['Ebene', 'Bezeichnung', 'Zahlungen', 'Rücklastschriften', 'Quote %', 'Betrag RL', 'Gebühren'];
    const line = (level: string, r: Row) => [
      level, r.label, r.payments, r.returns,
      r.quote.toFixed(1).replace('.', ','),
      r.returnAmount.toFixed(2).replace('.', ','),
      r.fees.toFixed(2).replace('.', ','),
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(sep);

    const csv = [
      head.join(sep),
      ...months.map(m => line('Monat', m)),
      ...filteredCustomers.map(c => line('Kunde', c)),
      ...(totals ? [line('Gesamt', totals)] : []),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Ruecklastschriftquote_${region}_${from}_${to}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };

  const exportPdf = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text(`Rücklastschriftquote · Buchhaltung ${region}`, 14, 16);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110);
    doc.text(`Zeitraum ${new Date(from).toLocaleDateString('de-DE')} – ${new Date(to).toLocaleDateString('de-DE')} · erstellt am ${new Date().toLocaleDateString('de-DE')}`, 14, 22);
    if (totals) doc.text(`Gesamt: ${totals.returns} Rücklastschriften bei ${totals.payments} Zahlungen · Quote ${pct(totals.quote)} · ${money(totals.returnAmount)}`, 14, 27);
    doc.setTextColor(0);

    const body = (rows: Row[]) => rows.map(r => [
      r.label, String(r.payments), String(r.returns), pct(r.quote), money(r.returnAmount), money(r.fees),
    ]);
    const head = [['Bezeichnung', 'Zahlungen', 'RL', 'Quote', 'Betrag', 'Gebühren']];

    autoTable(doc, {
      startY: 33, head, body: body(months), theme: 'grid', styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 41, 59] },
      didDrawPage: () => { doc.setFontSize(10); doc.setFont('helvetica', 'bold'); },
    });
    let y = (doc as any).lastAutoTable.finalY + 8;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text('Pro Kunde', 14, y);
    autoTable(doc, { startY: y + 3, head, body: body(filteredCustomers), theme: 'grid', styles: { fontSize: 8 }, headStyles: { fillColor: [30, 41, 59] } });

    doc.save(`Ruecklastschriftquote_${region}_${from}_${to}.pdf`);
  };

  const quoteColor = (q: number) => q >= 10 ? 'text-red-500' : q >= 5 ? 'text-amber-500' : 'text-emerald-500';

  const Table = ({ rows, first }: { rows: Row[]; first: string }) => (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-xs">
        <thead className="bg-muted/40"><tr className="text-left">
          <th className="p-2">{first}</th><th className="p-2 text-right">Zahlungen</th>
          <th className="p-2 text-right">Rücklastschriften</th><th className="p-2 text-right">Quote</th>
          <th className="p-2 text-right">Betrag</th><th className="p-2 text-right">Gebühren</th>
        </tr></thead>
        <tbody>
          {!rows.length && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Keine Daten im gewählten Zeitraum.</td></tr>}
          {rows.map(r => (
            <tr key={r.key} className="border-t border-border hover:bg-muted/30">
              <td className="p-2 font-medium">{r.label}</td>
              <td className="p-2 text-right">{r.payments}</td>
              <td className="p-2 text-right">{r.returns}</td>
              <td className={`p-2 text-right font-semibold ${quoteColor(r.quote)}`}>{pct(r.quote)}</td>
              <td className="p-2 text-right">{money(r.returnAmount)}</td>
              <td className="p-2 text-right">{money(r.fees)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-red-500" />Rücklastschriftquote
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Anteil der Rücklastschriften an allen Zahlungseingängen – pro Monat und pro Kunde.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Von</label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Bis</label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Kunde suchen</label>
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name oder Kundennr." className="w-56" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Min. Rücklastschriften</label>
              <Input type="number" min={0} value={minReturns} onChange={e => setMinReturns(Number(e.target.value) || 0)} className="w-32" />
            </div>
            <Button size="sm" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}Auswerten
            </Button>
            <Button size="sm" variant="outline" onClick={exportCsv}><FileSpreadsheet className="w-4 h-4 mr-1" />CSV</Button>
            <Button size="sm" variant="outline" onClick={exportPdf}><FileText className="w-4 h-4 mr-1" />PDF</Button>
          </div>

          {totals && (
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                { l: 'Zahlungseingänge', v: String(totals.payments) },
                { l: 'Rücklastschriften', v: String(totals.returns) },
                { l: 'Quote', v: pct(totals.quote) },
                { l: 'Rückgabevolumen', v: money(totals.returnAmount) },
              ].map(k => (
                <div key={k.l} className="rounded-md border border-border p-3">
                  <div className="text-[11px] uppercase text-muted-foreground">{k.l}</div>
                  <div className="text-lg font-semibold">{k.v}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Pro Monat</CardTitle></CardHeader>
        <CardContent><Table rows={months} first="Monat" /></CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            Pro Kunde <Badge variant="outline">{filteredCustomers.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent><Table rows={filteredCustomers} first="Kunde" /></CardContent>
      </Card>
    </div>
  );
}
