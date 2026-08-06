import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { DataCard } from '@/components/PageShell';
import { EmptyState } from '@/components/infinity/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { FileSpreadsheet, Plus, Download } from 'lucide-react';
import { fmtMoney, fmtDate } from '@/lib/commission/constants';
import { useCommissionPermissions } from '@/hooks/useCommissionPermissions';

export default function ProvisionAbrechnungen() {
  const perms = useCommissionPermissions();
  const [rows, setRows] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const today = new Date();
  const [form, setForm] = useState({
    employee_id: '',
    period_start: new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10),
    period_end: new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10),
  });

  const load = async () => {
    const [{ data: s }, { data: p }] = await Promise.all([
      supabase.from('commission_statements').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('user_profiles').select('id, full_name, email').order('full_name'),
    ]);
    setRows(s ?? []); setProfiles(p ?? []);
  };
  useEffect(() => { load(); }, []);

  const nameOf = (id: string) => profiles.find((p) => p.id === id)?.full_name || profiles.find((p) => p.id === id)?.email || '–';

  const create = async () => {
    if (!form.employee_id) return toast.error('Bitte Mitarbeiter wählen');
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('commission-engine', { body: { action: 'create_statement', ...form } });
    setBusy(false);
    if (error || (data as any)?.error) return toast.error((data as any)?.error ?? error?.message ?? 'Fehler');
    toast.success('Abrechnung erstellt'); setOpen(false); load();
  };

  const exportCsv = () => {
    const head = ['Abrechnungsnr', 'Mitarbeiter', 'Von', 'Bis', 'Gesamt', 'Rueckforderungen', 'Bereits gezahlt', 'Auszahlung', 'Status'];
    const lines = rows.map((r) => [r.statement_number, nameOf(r.employee_id), r.period_start, r.period_end, r.total_amount, r.reclaims_amount, r.already_paid_amount, r.payout_amount, r.status].join(';'));
    const blob = new Blob([[head.join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `provisionsabrechnungen-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="p-6 lg:p-8 animate-fade-in space-y-4">
      <PageHeader
        title="Provisionsabrechnungen"
        subtitle="Monatsabrechnungen je Mitarbeiter mit Gesamtsumme, Rückforderungen und Auszahlungsbetrag"
        icon={FileSpreadsheet}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />CSV</Button>
            {perms.canManage && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Abrechnung erstellen</Button>}
          </div>
        }
      />

      <DataCard className="p-0">
        <div className="p-5">
          {rows.length === 0 ? (
            <EmptyState icon={FileSpreadsheet} title="Keine Abrechnungen" description="Erstelle eine Monatsabrechnung für einen Mitarbeiter." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left">Abrechnung</th>
                    <th className="p-3 text-left">Mitarbeiter</th>
                    <th className="p-3 text-left">Zeitraum</th>
                    <th className="p-3 text-right">Gesamt</th>
                    <th className="p-3 text-right">Rückforderungen</th>
                    <th className="p-3 text-right">Bereits gezahlt</th>
                    <th className="p-3 text-right">Auszahlung</th>
                    <th className="p-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="p-3 font-mono text-xs">{r.statement_number}</td>
                      <td className="p-3">{nameOf(r.employee_id)}</td>
                      <td className="p-3">{fmtDate(r.period_start)} – {fmtDate(r.period_end)}</td>
                      <td className="p-3 text-right">{fmtMoney(r.total_amount, r.currency)}</td>
                      <td className="p-3 text-right">{fmtMoney(r.reclaims_amount, r.currency)}</td>
                      <td className="p-3 text-right">{fmtMoney(r.already_paid_amount, r.currency)}</td>
                      <td className="p-3 text-right font-medium">{fmtMoney(r.payout_amount, r.currency)}</td>
                      <td className="p-3">{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DataCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Abrechnung erstellen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Mitarbeiter</Label>
              <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                <SelectTrigger><SelectValue placeholder="wählen" /></SelectTrigger>
                <SelectContent>{profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Von</Label><Input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} /></div>
              <div><Label>Bis</Label><Input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={create} disabled={busy}>Erstellen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
