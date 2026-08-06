import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { DataCard } from '@/components/PageShell';
import { EmptyState } from '@/components/infinity/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Wallet, Plus } from 'lucide-react';
import { fmtMoney, fmtDate, PAYMENT_METHODS } from '@/lib/commission/constants';
import { useCommissionPermissions } from '@/hooks/useCommissionPermissions';

export default function ProvisionAuszahlungen() {
  const perms = useCommissionPermissions();
  const [payments, setPayments] = useState<any[]>([]);
  const [payable, setPayable] = useState<any[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    payment_date: new Date().toISOString().slice(0, 10),
    payment_method: 'bank_transfer',
    bank_account: '',
    booking_reference: '',
    purpose: 'Provisionsauszahlung',
    cost_center: '',
    note: '',
    period_start: '',
    period_end: '',
  });

  const load = async () => {
    const [{ data: pays }, { data: entries }, { data: profiles }] = await Promise.all([
      supabase.from('commission_payments').select('*').order('payment_date', { ascending: false }).limit(500),
      supabase.from('commission_entries').select('*').in('status', ['approved', 'payout_scheduled', 'partially_paid']).limit(1000),
      supabase.from('user_profiles').select('id, full_name, email'),
    ]);
    setPayments(pays ?? []);
    setPayable(entries ?? []);
    const map: Record<string, string> = {};
    (profiles ?? []).forEach((p: any) => { map[p.id] = p.full_name || p.email || p.id; });
    setNames(map);
  };
  useEffect(() => { load(); }, []);

  const selectedEmployee = useMemo(() => {
    const first = payable.find((e) => selected.has(e.id));
    return first?.employee_id ?? null;
  }, [selected, payable]);

  const selectedTotal = useMemo(
    () => payable.filter((e) => selected.has(e.id)).reduce((s, e) => s + Number(e.open_amount ?? e.commission_amount), 0),
    [selected, payable],
  );

  const submit = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('commission-engine', {
      body: { action: 'register_payment', entry_ids: [...selected], ...form },
    });
    setBusy(false);
    if (error || (data as any)?.error) return toast.error((data as any)?.error ?? error?.message ?? 'Auszahlung fehlgeschlagen');
    toast.success('Auszahlung erfasst');
    setOpen(false); setSelected(new Set()); load();
  };

  return (
    <div className="p-6 lg:p-8 animate-fade-in space-y-6">
      <PageHeader
        title="Auszahlungsübersicht"
        subtitle="Freigegebene Provisionen zur Auszahlung erfassen und dokumentieren"
        icon={Wallet}
        actions={perms.canManage ? (
          <Button disabled={selected.size === 0} onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />Auszahlung erfassen ({fmtMoney(selectedTotal)})
          </Button>
        ) : undefined}
      />

      <DataCard title="Auszahlbare Provisionen" className="p-0">
        <div className="p-5">
          {payable.length === 0 ? (
            <EmptyState icon={Wallet} title="Keine auszahlbaren Provisionen" description="Es sind aktuell keine freigegebenen Provisionen vorhanden." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="w-10 p-3" />
                    <th className="p-3 text-left">Provisionsnr.</th>
                    <th className="p-3 text-left">Mitarbeiter</th>
                    <th className="p-3 text-left">Auftrag</th>
                    <th className="p-3 text-left">Zahltermin</th>
                    <th className="p-3 text-right">Offener Betrag</th>
                  </tr>
                </thead>
                <tbody>
                  {payable.map((e) => {
                    const disabled = !!selectedEmployee && e.employee_id !== selectedEmployee;
                    return (
                      <tr key={e.id} className={disabled ? 'border-t border-border opacity-40' : 'border-t border-border'}>
                        <td className="p-3">
                          <Checkbox
                            checked={selected.has(e.id)}
                            disabled={disabled || !perms.canManage}
                            onCheckedChange={() => {
                              const n = new Set(selected);
                              n.has(e.id) ? n.delete(e.id) : n.add(e.id);
                              setSelected(n);
                            }}
                          />
                        </td>
                        <td className="p-3 font-mono text-xs">{e.entry_number}</td>
                        <td className="p-3">{names[e.employee_id] ?? '–'}</td>
                        <td className="p-3">{e.order_number ?? '–'}</td>
                        <td className="p-3">{fmtDate(e.payout_due_date)}</td>
                        <td className="p-3 text-right font-medium">{fmtMoney(e.open_amount ?? e.commission_amount, e.currency)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DataCard>

      <DataCard title="Erfasste Auszahlungen" className="p-0">
        <div className="p-5">
          {payments.length === 0 ? (
            <EmptyState icon={Wallet} title="Keine Auszahlungen" description="Es wurden noch keine Provisionsauszahlungen erfasst." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left">Auszahlung</th>
                    <th className="p-3 text-left">Mitarbeiter</th>
                    <th className="p-3 text-left">Datum</th>
                    <th className="p-3 text-left">Zahlungsart</th>
                    <th className="p-3 text-left">Referenz</th>
                    <th className="p-3 text-right">Betrag</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-t border-border">
                      <td className="p-3 font-mono text-xs">{p.payment_number}</td>
                      <td className="p-3">{names[p.employee_id] ?? '–'}</td>
                      <td className="p-3">{fmtDate(p.payment_date)}</td>
                      <td className="p-3">{PAYMENT_METHODS.find((m) => m.value === p.payment_method)?.label ?? p.payment_method}</td>
                      <td className="p-3">{p.booking_reference ?? '–'}</td>
                      <td className="p-3 text-right font-medium">{fmtMoney(p.amount, p.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DataCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Auszahlung erfassen · {fmtMoney(selectedTotal)}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Auszahlungsdatum</Label><Input type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} /></div>
            <div>
              <Label>Zahlungsart</Label>
              <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Abrechnungszeitraum von</Label><Input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} /></div>
            <div><Label>bis</Label><Input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} /></div>
            <div><Label>Bankkonto</Label><Input value={form.bank_account} onChange={(e) => setForm({ ...form, bank_account: e.target.value })} /></div>
            <div><Label>Buchungsreferenz</Label><Input value={form.booking_reference} onChange={(e) => setForm({ ...form, booking_reference: e.target.value })} /></div>
            <div><Label>Verwendungszweck</Label><Input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></div>
            <div><Label>Kostenstelle</Label><Input value={form.cost_center} onChange={(e) => setForm({ ...form, cost_center: e.target.value })} /></div>
            <div className="col-span-2"><Label>Bemerkung</Label><Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={submit} disabled={busy}>Auszahlung buchen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
