import { useEffect, useState } from 'react';
import { FileBarChart, Plus, Send, Trash2, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, PageLoading, DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

const SECTIONS = [
  { v: 'executive_summary', l: 'Executive Summary' },
  { v: 'pnl', l: 'GuV' },
  { v: 'balance', l: 'Bilanz' },
  { v: 'cashflow', l: 'Cashflow' },
  { v: 'budget_vs_actual', l: 'Budget vs. Ist' },
  { v: 'forecast', l: 'Rolling Forecast' },
  { v: 'kpis', l: 'KPIs' },
  { v: 'anomalies', l: 'Anomalien' },
];

export default function FinanceManagementPack() {
  const { roles } = useAuth();
  const canEdit = roles.includes('Super Admin') || roles.includes('Admin') || roles.includes('Finance');
  const isSuper = roles.includes('Super Admin');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
  const [form, setForm] = useState<any>({
    name: `Monatsbericht ${today.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}`,
    period_start: firstOfMonth, period_end: lastOfMonth,
    sections: ['executive_summary', 'pnl', 'cashflow', 'kpis'],
    recipients: '',
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('finance_management_packs' as any).select('*').order('created_at', { ascending: false });
    setRows((data ?? []) as any[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      const payload: any = {
        name: form.name, period_start: form.period_start, period_end: form.period_end,
        sections: form.sections, status: 'draft',
      };
      const { error } = await supabase.from('finance_management_packs' as any).insert(payload);
      if (error) throw error;
      toast({ title: 'Management-Pack angelegt' });
      setShow(false);
      load();
    } catch (e: any) {
      toast({ title: 'Fehler', description: e.message, variant: 'destructive' });
    }
  };

  const generate = async (id: string) => {
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke('finance-management-pack', { body: { pack_id: id, action: 'generate' } });
      if (error) throw error;
      toast({ title: 'Pack generiert' });
      load();
    } catch (e: any) {
      toast({ title: 'Fehler', description: e.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const send = async (id: string) => {
    const to = prompt('Empfänger (E-Mails, komma-separiert):');
    if (!to) return;
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke('finance-management-pack', {
        body: { pack_id: id, action: 'send', recipients: to.split(',').map(s => s.trim()) },
      });
      if (error) throw error;
      toast({ title: 'Pack versendet' });
      load();
    } catch (e: any) {
      toast({ title: 'Fehler', description: e.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const del = async (id: string) => {
    if (!confirm('Pack löschen?')) return;
    await supabase.from('finance_management_packs' as any).delete().eq('id', id);
    load();
  };

  const toggleSection = (v: string) => {
    setForm((f: any) => ({ ...f, sections: f.sections.includes(v) ? f.sections.filter((x: string) => x !== v) : [...f.sections, v] }));
  };

  if (loading) return <PageLoading />;

  return (
    <div className="space-y-6">
      <PageHeader title="Management-Pack" subtitle="Monats- und Quartalspakete für Geschäftsführung & Beirat" icon={FileBarChart}
        actions={canEdit && <Button onClick={() => setShow(true)} className="gap-2"><Plus className="h-4 w-4" />Neues Pack</Button>} />

      <DataCard title={`Pakete (${rows.length})`}>
        {rows.length === 0 ? <div className="p-8 text-center text-muted-foreground">Noch keine Pakete erstellt.</div> : (
          <div className="divide-y divide-border">
            {rows.map(r => (
              <div key={r.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {r.name}
                    <Badge variant={r.status === 'sent' ? 'default' : r.status === 'generated' ? 'secondary' : 'outline'}>{r.status}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {r.period_start} bis {r.period_end} · {(r.sections || []).length} Sektionen
                  </div>
                  {r.sent_at && <div className="text-xs text-muted-foreground mt-1">Versendet: {new Date(r.sent_at).toLocaleString('de-DE')}</div>}
                </div>
                <div className="flex gap-2">
                  {r.pdf_url && <Button size="sm" variant="outline" asChild><a href={r.pdf_url} target="_blank" rel="noreferrer"><Download className="h-4 w-4" /></a></Button>}
                  {canEdit && r.status === 'draft' && <Button size="sm" variant="outline" onClick={() => generate(r.id)} disabled={busy}>Generieren</Button>}
                  {canEdit && r.status !== 'draft' && <Button size="sm" variant="outline" onClick={() => send(r.id)} disabled={busy}><Send className="h-4 w-4" /></Button>}
                  {isSuper && <Button size="sm" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-4 w-4" /></Button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </DataCard>

      <Dialog open={show} onOpenChange={setShow}>
        <DialogContent>
          <DialogHeader><DialogTitle>Neues Management-Pack</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Von</label>
                <Input type="date" value={form.period_start} onChange={e => setForm({ ...form, period_start: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Bis</label>
                <Input type="date" value={form.period_end} onChange={e => setForm({ ...form, period_end: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Sektionen</label>
              <div className="flex flex-wrap gap-2">
                {SECTIONS.map(s => (
                  <Badge key={s.v} variant={form.sections.includes(s.v) ? 'default' : 'outline'}
                    className="cursor-pointer" onClick={() => toggleSection(s.v)}>{s.l}</Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShow(false)}>Abbrechen</Button>
            <Button onClick={save} disabled={!form.name}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
