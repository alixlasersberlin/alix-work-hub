import { useEffect, useState } from 'react';
import { Download, Calculator } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, PageLoading, DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const fmt = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0);

// Tax rate per tenant: DE 19/7, AT 20/10
const RATES: Record<string, { standard: number; reduced: number }> = {
  zoho_eu_1: { standard: 0.19, reduced: 0.07 },
  zoho_eu_2: { standard: 0.20, reduced: 0.10 },
  default: { standard: 0.19, reduced: 0.07 },
};

export default function FinanceSteuer() {
  const today = new Date();
  const ym = today.toISOString().slice(0, 7);
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [month, setMonth] = useState(ym);
  const [year, setYear] = useState(String(today.getFullYear()));
  const [quarter, setQuarter] = useState(String(Math.ceil((today.getMonth() + 1) / 3)));
  const [tenants, setTenants] = useState<any[]>([]);
  const [tenantId, setTenantId] = useState<string>('all');
  const [tx, setTx] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const range = () => {
    if (period === 'month') {
      const [y, m] = month.split('-').map(Number);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0);
      return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
    }
    if (period === 'quarter') {
      const y = Number(year), q = Number(quarter);
      const start = new Date(y, (q - 1) * 3, 1);
      const end = new Date(y, q * 3, 0);
      return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
    }
    return { from: `${year}-01-01`, to: `${year}-12-31` };
  };

  const load = async () => {
    setLoading(true);
    const { from, to } = range();
    let q = supabase.from('finance_transactions')
      .select('id, customer_id, amount, transaction_type, booking_date, reference, customer:customer_id(source_system)')
      .gte('booking_date', from)
      .lte('booking_date', to)
      .order('booking_date');
    const { data } = await q;
    let rows = data ?? [];
    if (tenantId !== 'all') {
      const tenant = tenants.find(t => t.id === tenantId);
      if (tenant?.zoho_source_system) {
        rows = rows.filter((r: any) => r.customer?.source_system === tenant.zoho_source_system);
      }
    }
    setTx(rows);
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('tenants').select('id, name, zoho_source_system, flag_emoji').eq('is_active', true).order('sort_order');
      setTenants(data ?? []);
    })();
  }, []);

  useEffect(() => { load(); }, [period, month, year, quarter, tenantId, tenants.length]);

  // Aggregate
  const groups: Record<string, { brutto: number; netto19: number; ust19: number; netto7: number; ust7: number; count: number }> = {
    'Alix Deutschland 🇩🇪': { brutto: 0, netto19: 0, ust19: 0, netto7: 0, ust7: 0, count: 0 },
    'Alix Austria 🇦🇹': { brutto: 0, netto19: 0, ust19: 0, netto7: 0, ust7: 0, count: 0 },
  };
  let totalIncome = 0, totalPayments = 0;
  for (const r of tx) {
    const src = r.customer?.source_system ?? 'zoho_eu_1';
    const rates = RATES[src] ?? RATES.default;
    const key = src === 'zoho_eu_2' ? 'Alix Austria 🇦🇹' : 'Alix Deutschland 🇩🇪';
    const amt = Number(r.amount) || 0;
    if (r.transaction_type === 'Rechnung') {
      const netto = amt / (1 + rates.standard);
      const ust = amt - netto;
      groups[key].brutto += amt;
      groups[key].netto19 += netto;
      groups[key].ust19 += ust;
      groups[key].count += 1;
      totalIncome += amt;
    } else if (r.transaction_type === 'Zahlung') {
      totalPayments += amt;
    }
  }

  const exportCsv = () => {
    const { from, to } = range();
    const rows = [['Mandant', 'Brutto', 'Netto', 'USt', 'Anzahl Rechnungen']];
    Object.entries(groups).forEach(([k, v]) => {
      rows.push([k, v.brutto.toFixed(2), v.netto19.toFixed(2), v.ust19.toFixed(2), String(v.count)]);
    });
    const csv = rows.map(r => r.map(c => `"${c}"`).join(';')).join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Steuer_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (loading) return <PageLoading />;

  return (
    <div className="space-y-6">
      <PageHeader title="Steuer-Auswertung" subtitle="USt-Vorbereitung pro Mandant für Steuerberater" icon={Calculator} />

      <DataCard title="Zeitraum">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <Label>Periode</Label>
            <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Monat</SelectItem>
                <SelectItem value="quarter">Quartal</SelectItem>
                <SelectItem value="year">Jahr</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {period === 'month' && <div><Label>Monat</Label><Input type="month" value={month} onChange={e => setMonth(e.target.value)} /></div>}
          {period === 'quarter' && <>
            <div><Label>Jahr</Label><Input type="number" value={year} onChange={e => setYear(e.target.value)} className="w-28" /></div>
            <div><Label>Quartal</Label>
              <Select value={quarter} onValueChange={setQuarter}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>{['1', '2', '3', '4'].map(q => <SelectItem key={q} value={q}>Q{q}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </>}
          {period === 'year' && <div><Label>Jahr</Label><Input type="number" value={year} onChange={e => setYear(e.target.value)} className="w-28" /></div>}
          <div>
            <Label>Mandant</Label>
            <Select value={tenantId} onValueChange={setTenantId}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Mandanten</SelectItem>
                {tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.flag_emoji} {t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={exportCsv} variant="outline"><Download className="h-4 w-4 mr-2" />CSV Export</Button>
        </div>
      </DataCard>

      <div className="grid md:grid-cols-3 gap-4">
        <DataCard title="Umsatz Brutto"><div className="text-2xl font-semibold">{fmt(totalIncome)}</div><div className="text-xs text-muted-foreground">{tx.filter(t => t.transaction_type === 'Rechnung').length} Rechnungen</div></DataCard>
        <DataCard title="Zahlungen"><div className="text-2xl font-semibold">{fmt(totalPayments)}</div></DataCard>
        <DataCard title="USt gesamt"><div className="text-2xl font-semibold">{fmt(Object.values(groups).reduce((s, g) => s + g.ust19, 0))}</div></DataCard>
      </div>

      <DataCard title="Aufschlüsselung pro Mandant">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b border-border">
              <th className="p-2">Mandant</th><th className="p-2 text-right">Rechnungen</th>
              <th className="p-2 text-right">Brutto</th><th className="p-2 text-right">Netto</th>
              <th className="p-2 text-right">USt</th>
            </tr></thead>
            <tbody>
              {Object.entries(groups).map(([k, v]) => (
                <tr key={k} className="border-b border-border/50">
                  <td className="p-2 font-medium">{k}</td>
                  <td className="p-2 text-right">{v.count}</td>
                  <td className="p-2 text-right">{fmt(v.brutto)}</td>
                  <td className="p-2 text-right">{fmt(v.netto19)}</td>
                  <td className="p-2 text-right">{fmt(v.ust19)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Hinweis: Beträge werden vereinfachend mit dem Standard-USt-Satz des jeweiligen Mandanten (DE 19 %, AT 20 %) herausgerechnet. Für die offizielle UStVA bitte mit dem Steuerberater abstimmen.
        </p>
      </DataCard>
    </div>
  );
}
