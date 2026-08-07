import { useEffect, useMemo, useState } from 'react';
import { Landmark, Download, Plus, Loader2, CheckCircle2, AlertTriangle, Wallet, CalendarClock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DataCard, PageEmpty } from '@/components/PageShell';
import { PageHeader } from '@/components/infinity/PageHeader';
import { SkeletonKpiGrid, SkeletonTable } from '@/components/infinity/Skeleton';
import { KpiTile } from '@/components/infinity/KpiTile';
import { InfinityStatusBadge } from '@/components/infinity/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { useAccountingRegion } from '@/contexts/AccountingRegionContext';

const STATUS_LABEL: Record<string, string> = {
  open: 'offen',
  partial: 'teilweise bezahlt',
  paid: 'bezahlt',
  overdue: 'überfällig',
};

// EU: 10. des Folgemonats · CH: 60 Tage nach Periodenende
function computeDueDate(periodValue: string, region: 'EU' | 'CH'): string {
  const today = new Date();
  let end: Date;
  const q = periodValue?.match(/^(\d{4})-Q([1-4])$/);
  const m = periodValue?.match(/^(\d{4})-(\d{2})$/);
  const y = periodValue?.match(/^(\d{4})$/);
  if (q) end = new Date(Number(q[1]), Number(q[2]) * 3, 0);
  else if (m) end = new Date(Number(m[1]), Number(m[2]), 0);
  else if (y) end = new Date(Number(y[1]), 11, 31);
  else end = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const due = new Date(end);
  if (region === 'CH') due.setDate(due.getDate() + 60);
  else due.setMonth(due.getMonth() + 1, 10);
  return due.toISOString().slice(0, 10);
}

export default function FinanceSteuerkonto() {
  const { region } = useAccountingRegion();
  const currency = region === 'CH' ? 'CHF' : 'EUR';
  const fmt = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(Number(n) || 0);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [filings, setFilings] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [openNew, setOpenNew] = useState(false);
  const [filingId, setFilingId] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');

  const [payTarget, setPayTarget] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payRef, setPayRef] = useState('');

  const load = async () => {
    setLoading(true);
    const [{ data: p }, { data: f }, { data: t }] = await Promise.all([
      supabase.from('finance_tax_payments' as any).select('*').in('accounting_region', region === 'ALL' ? ['EU','CH'] : [region]).order('due_date', { ascending: false }).limit(300),
      supabase.from('finance_tax_filings' as any).select('id,filing_type,period_value,total_amount,currency,tenant_id,status').in('accounting_region', region === 'ALL' ? ['EU','CH'] : [region]).order('created_at', { ascending: false }).limit(100),
      supabase.from('tenants' as any).select('id,name,flag_emoji').eq('is_active', true).order('sort_order'),
    ]);
    setPayments((p ?? []) as any);
    setFilings((f ?? []) as any);
    setTenants((t ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, [region]);

  const tname = (id: string | null) => {
    const t = tenants.find((x) => x.id === id);
    return t ? `${t.flag_emoji ?? ''} ${t.name}`.trim() : '–';
  };

  const selectedFiling = filings.find((f) => f.id === filingId);
  useEffect(() => {
    if (!selectedFiling) return;
    setAmount(String(Number(selectedFiling.total_amount ?? 0).toFixed(2)));
    setDueDate(computeDueDate(selectedFiling.period_value, region));
  }, [filingId]);

  const createPayment = async () => {
    if (!selectedFiling) return toast({ title: 'Bitte Meldung wählen', variant: 'destructive' });
    setBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from('finance_tax_payments' as any).insert({
      filing_id: selectedFiling.id,
      tenant_id: selectedFiling.tenant_id ?? null,
      accounting_region: (region === 'ALL' ? 'EU' : region),
      filing_type: selectedFiling.filing_type,
      period_value: selectedFiling.period_value,
      due_date: dueDate || computeDueDate(selectedFiling.period_value, region),
      amount: Number(amount) || 0,
      currency,
      created_by: auth?.user?.id ?? null,
    });
    setBusy(false);
    if (error) return toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    toast({ title: 'Zahllast angelegt', description: `${selectedFiling.period_value} · ${fmt(Number(amount))}` });
    setOpenNew(false); setFilingId(''); setAmount(''); setDueDate('');
    load();
  };

  const bookPayment = async () => {
    if (!payTarget) return;
    setBusy(true);
    const paid = (Number(payTarget.paid_amount) || 0) + (Number(payAmount) || 0);
    const { error } = await supabase.from('finance_tax_payments' as any).update({
      paid_amount: paid,
      paid_date: payDate,
      payment_reference: payRef || payTarget.payment_reference,
    }).eq('id', payTarget.id);
    setBusy(false);
    if (error) return toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    toast({ title: 'Zahlung gebucht', description: fmt(Number(payAmount)) });
    setPayTarget(null); setPayAmount(''); setPayRef('');
    load();
  };

  const filtered = useMemo(
    () => payments.filter((p) => statusFilter === 'all' || p.status === statusFilter),
    [payments, statusFilter],
  );

  const kpis = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    let openSum = 0, paidSum = 0, overdueSum = 0, next30 = 0;
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    for (const p of payments) {
      const amt = Number(p.amount) || 0;
      const paid = Number(p.paid_amount) || 0;
      paidSum += paid;
      const rest = amt - paid;
      if (rest > 0.005) {
        openSum += rest;
        if (p.due_date < todayStr) overdueSum += rest;
        else if (p.due_date <= in30) next30 += rest;
      }
    }
    return { openSum, paidSum, overdueSum, next30 };
  }, [payments]);

  const exportCsv = () => {
    const rows = [['Periode', 'Art', 'Mandant', 'Faellig', 'Betrag', 'Bezahlt', 'Offen', 'Zahldatum', 'Referenz', 'Status']];
    filtered.forEach((p) => rows.push([
      p.period_value ?? '', p.filing_type ?? '', tname(p.tenant_id), p.due_date ?? '',
      Number(p.amount ?? 0).toFixed(2), Number(p.paid_amount ?? 0).toFixed(2),
      (Number(p.amount ?? 0) - Number(p.paid_amount ?? 0)).toFixed(2),
      p.paid_date ?? '', p.payment_reference ?? '', STATUS_LABEL[p.status] ?? p.status,
    ]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Steuerkonto_${region}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-6 container mx-auto px-4 py-8">
      <PageHeader
        icon={Landmark}
        title={`Steuerkonto ${region === 'CH' ? '🇨🇭' : '🇪🇺'}`}
        subtitle={region === 'CH' ? 'Zahllasten & Abstimmung ESTV-Konto' : 'Zahllasten & Abstimmung Finanzamt-Konto'}
        noBreadcrumbs
        meta={<InfinityStatusBadge kind={loading ? 'progress' : 'done'} label={loading ? 'Lädt' : `${payments.length} Positionen`} pulse={loading} />}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />CSV</Button>
            <Button size="sm" onClick={() => setOpenNew(true)}><Plus className="h-4 w-4 mr-2" />Zahllast anlegen</Button>
          </div>
        }
      />

      {loading ? (
        <>
          <SkeletonKpiGrid count={4} />
          <DataCard><div className="p-4"><SkeletonTable rows={6} cols={7} /></div></DataCard>
        </>
      ) : (
        <>
          <div className="grid md:grid-cols-4 gap-4">
            <KpiTile icon={Wallet} label="Offene Zahllast" value={fmt(kpis.openSum)} accent="gold" />
            <KpiTile icon={AlertTriangle} label="Überfällig" value={fmt(kpis.overdueSum)} accent="rose" />
            <KpiTile icon={CalendarClock} label="Fällig in 30 Tagen" value={fmt(kpis.next30)} accent="violet" />
            <KpiTile icon={CheckCircle2} label="Bezahlt gesamt" value={fmt(kpis.paidSum)} accent="emerald" />
          </div>

          <DataCard title="Filter">
            <div className="p-4 flex flex-wrap gap-3 items-end">
              <div>
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="open">Offen</SelectItem>
                    <SelectItem value="partial">Teilweise bezahlt</SelectItem>
                    <SelectItem value="overdue">Überfällig</SelectItem>
                    <SelectItem value="paid">Bezahlt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </DataCard>

          {filtered.length === 0 ? (
            <PageEmpty message="Keine Zahllasten erfasst. Lege eine Position aus einer Steuermeldung an." />
          ) : (
            <DataCard title={`${filtered.length} Positionen`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/40 text-muted-foreground">
                    <tr>
                      <th className="text-left p-3">Periode</th>
                      <th className="text-left p-3">Art</th>
                      <th className="text-left p-3">Mandant</th>
                      <th className="text-left p-3">Fällig</th>
                      <th className="text-right p-3">Betrag</th>
                      <th className="text-right p-3">Bezahlt</th>
                      <th className="text-right p-3">Offen</th>
                      <th className="text-center p-3">Status</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => {
                      const rest = Number(p.amount ?? 0) - Number(p.paid_amount ?? 0);
                      return (
                        <tr key={p.id} className="border-b border-border/20">
                          <td className="p-3 font-medium">{p.period_value ?? '–'}</td>
                          <td className="p-3 uppercase text-xs">{p.filing_type ?? '–'}</td>
                          <td className="p-3">{tname(p.tenant_id)}</td>
                          <td className="p-3">{p.due_date}</td>
                          <td className="p-3 text-right">{fmt(p.amount)}</td>
                          <td className="p-3 text-right">{fmt(p.paid_amount)}</td>
                          <td className="p-3 text-right font-medium">{fmt(rest)}</td>
                          <td className="p-3 text-center">
                            <Badge variant={p.status === 'paid' ? 'default' : p.status === 'overdue' ? 'destructive' : 'outline'}>
                              {STATUS_LABEL[p.status] ?? p.status}
                            </Badge>
                          </td>
                          <td className="p-3 text-right">
                            {rest > 0.005 && (
                              <Button size="sm" variant="outline" onClick={() => { setPayTarget(p); setPayAmount(rest.toFixed(2)); setPayRef(p.payment_reference ?? ''); }}>
                                Zahlung buchen
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </DataCard>
          )}
        </>
      )}

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Zahllast aus Steuermeldung anlegen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Steuermeldung</Label>
              <Select value={filingId} onValueChange={setFilingId}>
                <SelectTrigger><SelectValue placeholder="Meldung wählen" /></SelectTrigger>
                <SelectContent>
                  {filings.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.filing_type.toUpperCase()} · {f.period_value} · {fmt(Number(f.total_amount ?? 0))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Betrag</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
              <div><Label>Fällig am</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
            </div>
            <p className="text-xs text-muted-foreground">
              Fälligkeit automatisch: {region === 'CH' ? '60 Tage nach Periodenende (ESTV)' : '10. des Folgemonats (Finanzamt)'}
            </p>
            <div className="flex justify-end">
              <Button onClick={createPayment} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}Anlegen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!payTarget} onOpenChange={(o) => !o && setPayTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Zahlung buchen · {payTarget?.period_value}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Betrag</Label><Input type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} /></div>
              <div><Label>Zahldatum</Label><Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} /></div>
            </div>
            <div><Label>Referenz / Beleg</Label><Input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="z. B. Banktransaktion, QR-Referenz" /></div>
            <div className="flex justify-end">
              <Button onClick={bookPayment} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}Buchen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
