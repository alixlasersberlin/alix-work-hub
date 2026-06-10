import { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCcw, Download, TrendingUp, AlertTriangle, Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, PageLoading, DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, LineChart, Line } from 'recharts';

const fmtEUR = (n: any) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n || 0));

function monthsRange(startISO: string, count: number): string[] {
  const [y, m] = startISO.split('-').map(Number);
  const arr: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(y, (m - 1) + i, 1));
    arr.push(d.toISOString().slice(0, 7));
  }
  return arr;
}

export default function FinanceLiquiditaet() {
  const { roles } = useAuth();
  const canEdit = roles.includes('Super Admin') || roles.includes('Admin') || roles.includes('Finance');

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newPlan, setNewPlan] = useState<any>({});
  const [refreshing, setRefreshing] = useState(false);

  const loadPlans = async () => {
    setLoading(true);
    const [{ data: p }, { data: t }] = await Promise.all([
      supabase.from('finance_cashflow_plans' as any).select('*').order('created_at', { ascending: false }),
      supabase.from('tenants').select('id, name'),
    ]);
    setPlans((p ?? []) as any[]);
    setTenants(t ?? []);
    if (p && p.length && !selectedPlan) setSelectedPlan(p[0]);
    setLoading(false);
  };

  const loadItems = async (planId: string) => {
    const { data } = await supabase.from('finance_cashflow_items' as any).select('*').eq('plan_id', planId).order('month');
    setItems((data ?? []) as any[]);
  };

  useEffect(() => { loadPlans(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { if (selectedPlan?.id) loadItems(selectedPlan.id); }, [selectedPlan?.id]);

  const monthsList = useMemo(() => {
    if (!selectedPlan) return [];
    const months = Math.max(1, Math.ceil((new Date(selectedPlan.period_end).getTime() - new Date(selectedPlan.period_start).getTime()) / (30.44 * 24 * 3600 * 1000)) + 1);
    return monthsRange(selectedPlan.period_start.slice(0, 7), Math.min(months, 24));
  }, [selectedPlan]);

  const rowsByMonth = useMemo(() => {
    const result: Record<string, { ein_plan: number; ein_ist: number; aus_plan: number; aus_ist: number }> = {};
    for (const m of monthsList) result[m] = { ein_plan: 0, ein_ist: 0, aus_plan: 0, aus_ist: 0 };
    for (const it of items) {
      const k = it.month.slice(0, 7);
      if (!result[k]) continue;
      if (it.flow_type === 'einnahme') { result[k].ein_plan += Number(it.planned_amount); result[k].ein_ist += Number(it.actual_amount); }
      else { result[k].aus_plan += Number(it.planned_amount); result[k].aus_ist += Number(it.actual_amount); }
    }
    return result;
  }, [items, monthsList]);

  const chartData = useMemo(() => {
    let saldo = Number(selectedPlan?.opening_balance || 0);
    return monthsList.map(m => {
      const r = rowsByMonth[m];
      const netto = (r.ein_plan - r.aus_plan);
      saldo += netto;
      return {
        month: new Date(m + '-01').toLocaleDateString('de-DE', { month: 'short', year: '2-digit' }),
        Einnahmen: Math.round(r.ein_plan),
        Ausgaben: Math.round(r.aus_plan),
        Saldo: Math.round(saldo),
      };
    });
  }, [monthsList, rowsByMonth, selectedPlan]);

  const totals = useMemo(() => {
    let saldo = Number(selectedPlan?.opening_balance || 0);
    let minSaldo = saldo;
    let totalIn = 0, totalOut = 0;
    for (const m of monthsList) {
      const r = rowsByMonth[m];
      saldo += (r.ein_plan - r.aus_plan);
      totalIn += r.ein_plan; totalOut += r.aus_plan;
      if (saldo < minSaldo) minSaldo = saldo;
    }
    return { endSaldo: saldo, minSaldo, totalIn, totalOut };
  }, [monthsList, rowsByMonth, selectedPlan]);

  const createPlan = async () => {
    if (!newPlan.name || !newPlan.period_start) { toast({ title: 'Bitte Name und Startmonat angeben', variant: 'destructive' }); return; }
    const start = newPlan.period_start + '-01';
    const end = new Date(new Date(start).setMonth(new Date(start).getMonth() + 11)).toISOString().slice(0, 10);
    const { data, error } = await supabase.from('finance_cashflow_plans' as any).insert({
      name: newPlan.name,
      tenant_id: newPlan.tenant_id || null,
      period_start: start, period_end: end,
      opening_balance: Number(newPlan.opening_balance || 0),
      status: 'aktiv',
    }).select().single();
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Plan angelegt' });
    setDialogOpen(false); setNewPlan({});
    await loadPlans();
    setSelectedPlan(data);
  };

  const autoFill = async () => {
    if (!selectedPlan) return;
    setRefreshing(true);
    try {
      // Delete existing auto entries
      await supabase.from('finance_cashflow_items' as any).delete().eq('plan_id', selectedPlan.id).neq('source', 'manuell');

      const start = selectedPlan.period_start;
      const end = selectedPlan.period_end;
      const tenantFilter = selectedPlan.tenant_id;

      // Einnahmen: offene Zoho-Rechnungen
      let invQ = supabase.from('zoho_unpaid_invoices' as any).select('balance, due_date, source_system, customer_name').gte('due_date', start).lte('due_date', end);
      const { data: invs } = await invQ;

      // Wiederkehrend
      const { data: rec } = await supabase.from('zoho_recurring_profiles' as any).select('amount, next_invoice_date, customer_name').gte('next_invoice_date', start).lte('next_invoice_date', end);

      // Ausgaben: Eingangsrechnungen
      let inQ = supabase.from('finance_incoming_invoices' as any).select('amount_gross, due_date, supplier_name, tenant_id, status').gte('due_date', start).lte('due_date', end).not('status', 'in', '("bezahlt","storniert","abgelehnt")');
      if (tenantFilter) inQ = inQ.eq('tenant_id', tenantFilter);
      const { data: incoming } = await inQ;

      // Geplante AfA (informativ)
      const { data: assets } = await supabase.from('finance_assets' as any).select('acquisition_value, useful_life_months, depreciation_method, book_value, tenant_id').eq('status', 'aktiv');

      const inserts: any[] = [];
      const monthKey = (d: string) => d.slice(0, 7) + '-01';

      for (const i of invs ?? []) {
        inserts.push({ plan_id: selectedPlan.id, month: monthKey(i.due_date), category: 'Forderungen Zoho', flow_type: 'einnahme', planned_amount: Number(i.balance), source: 'auto_zoho', description: i.customer_name });
      }
      for (const r of rec ?? []) {
        inserts.push({ plan_id: selectedPlan.id, month: monthKey(r.next_invoice_date), category: 'Wiederkehrend', flow_type: 'einnahme', planned_amount: Number(r.amount), source: 'auto_recurring', description: r.customer_name });
      }
      for (const x of incoming ?? []) {
        if (!x.due_date) continue;
        inserts.push({ plan_id: selectedPlan.id, month: monthKey(x.due_date), category: 'Eingangsrechnungen', flow_type: 'ausgabe', planned_amount: Number(x.amount_gross || 0), source: 'auto_incoming', description: x.supplier_name });
      }
      // AfA monatlich (informativ) – über alle Planmonate verteilen
      const afaMonthly = (assets ?? []).reduce((sum, a) => {
        if (a.depreciation_method === 'gwg_sofort') return sum;
        const m = a.depreciation_method === 'gwg_pool' ? Number(a.acquisition_value) / 60 : Number(a.acquisition_value) / Math.max(a.useful_life_months || 36, 1);
        return sum + Math.min(m, Number(a.book_value || 0));
      }, 0);
      if (afaMonthly > 0) {
        for (const m of monthsList) {
          inserts.push({ plan_id: selectedPlan.id, month: m + '-01', category: 'AfA (kalkulatorisch)', flow_type: 'ausgabe', planned_amount: Math.round(afaMonthly * 100) / 100, source: 'auto_afa', description: 'Monatliche Abschreibung' });
        }
      }

      if (inserts.length) {
        const { error } = await supabase.from('finance_cashflow_items' as any).insert(inserts);
        if (error) throw error;
      }
      toast({ title: 'Auto-Befüllung abgeschlossen', description: `${inserts.length} Positionen` });
      await loadItems(selectedPlan.id);
    } catch (e: any) {
      toast({ title: 'Fehler', description: e.message, variant: 'destructive' });
    } finally { setRefreshing(false); }
  };

  const exportCSV = () => {
    const rows = [['Monat', 'Einnahmen geplant', 'Einnahmen ist', 'Ausgaben geplant', 'Ausgaben ist', 'Netto']];
    for (const m of monthsList) {
      const r = rowsByMonth[m];
      rows.push([m, String(r.ein_plan), String(r.ein_ist), String(r.aus_plan), String(r.aus_ist), String(r.ein_plan - r.aus_plan)]);
    }
    const csv = rows.map(r => r.map(c => `"${c}"`).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `liquiditaet-${selectedPlan?.name?.replace(/\s+/g, '_')}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  if (loading) return <PageLoading />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Liquiditätsplanung"
        subtitle="12-Monats-Forecast: Cashflow & Saldo"
        actions={canEdit ? <Button onClick={() => setDialogOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Neuer Plan</Button> : undefined}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedPlan?.id ?? ''} onValueChange={v => setSelectedPlan(plans.find(p => p.id === v))}>
          <SelectTrigger className="w-[320px]"><SelectValue placeholder="Plan wählen…" /></SelectTrigger>
          <SelectContent>
            {plans.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name} · {p.period_start?.slice(0, 7)} – {p.period_end?.slice(0, 7)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedPlan && (
          <>
            <Badge variant="outline">Startsaldo: {fmtEUR(selectedPlan.opening_balance)}</Badge>
            {canEdit && (
              <Button variant="outline" disabled={refreshing} onClick={autoFill} className="gap-2">
                <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Auto-befüllen
              </Button>
            )}
            <Button variant="outline" onClick={exportCSV} className="gap-2"><Download className="h-4 w-4" /> CSV</Button>
          </>
        )}
      </div>

      {selectedPlan && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DataCard title="Geplante Einnahmen"><div className="text-2xl font-semibold">{fmtEUR(totals.totalIn)}</div></DataCard>
            <DataCard title="Geplante Ausgaben"><div className="text-2xl font-semibold">{fmtEUR(totals.totalOut)}</div></DataCard>
            <DataCard title="Endsaldo"><div className="text-2xl font-semibold">{fmtEUR(totals.endSaldo)}</div></DataCard>
            <DataCard title="Minimum-Saldo"><div className="text-2xl font-semibold">{fmtEUR(totals.minSaldo)}</div></DataCard>
          </div>

          {totals.minSaldo < 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Warnung: Im Planzeitraum droht eine Unterdeckung von {fmtEUR(totals.minSaldo)}.
            </div>
          )}

          <div className="rounded-md border border-border bg-card p-4">
            <div className="font-medium mb-3">Cashflow-Forecast</div>
            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(v: any) => fmtEUR(v)} />
                  <Legend />
                  <Bar dataKey="Einnahmen" fill="hsl(var(--primary))" />
                  <Bar dataKey="Ausgaben" fill="#ef4444" />
                  <Line type="monotone" dataKey="Saldo" stroke="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-md border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left">Monat</th>
                    <th className="p-3 text-right">Einnahmen (Plan)</th>
                    <th className="p-3 text-right">Einnahmen (Ist)</th>
                    <th className="p-3 text-right">Ausgaben (Plan)</th>
                    <th className="p-3 text-right">Ausgaben (Ist)</th>
                    <th className="p-3 text-right">Netto</th>
                  </tr>
                </thead>
                <tbody>
                  {monthsList.map(m => {
                    const r = rowsByMonth[m];
                    const netto = r.ein_plan - r.aus_plan;
                    return (
                      <tr key={m} className="border-t border-border">
                        <td className="p-3 font-medium">{new Date(m + '-01').toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</td>
                        <td className="p-3 text-right">{fmtEUR(r.ein_plan)}</td>
                        <td className="p-3 text-right text-muted-foreground">{fmtEUR(r.ein_ist)}</td>
                        <td className="p-3 text-right">{fmtEUR(r.aus_plan)}</td>
                        <td className="p-3 text-right text-muted-foreground">{fmtEUR(r.aus_ist)}</td>
                        <td className={`p-3 text-right font-medium ${netto < 0 ? 'text-destructive' : ''}`}>{fmtEUR(netto)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Neuer Liquiditätsplan</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={newPlan.name ?? ''} onChange={e => setNewPlan({ ...newPlan, name: e.target.value })} placeholder="z. B. Q1 2026" /></div>
            <div><Label>Mandant</Label>
              <Select value={newPlan.tenant_id ?? ''} onValueChange={v => setNewPlan({ ...newPlan, tenant_id: v })}>
                <SelectTrigger><SelectValue placeholder="Alle Mandanten" /></SelectTrigger>
                <SelectContent>{tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Startmonat *</Label><Input type="month" value={newPlan.period_start ?? ''} onChange={e => setNewPlan({ ...newPlan, period_start: e.target.value })} /></div>
            <div><Label>Startsaldo (Bank)</Label><Input type="number" step="0.01" value={newPlan.opening_balance ?? ''} onChange={e => setNewPlan({ ...newPlan, opening_balance: e.target.value })} /></div>
            <div className="text-xs text-muted-foreground">Zeitraum: 12 Monate ab Startmonat. Anschließend „Auto-befüllen" um Daten aus Zoho, Eingangsrechnungen und AfA zu importieren.</div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={createPlan}>Anlegen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
