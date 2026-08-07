import { useEffect, useState } from 'react';
import { Landmark, Plus, Download, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { SkeletonTable } from '@/components/infinity/Skeleton';
import { EmptyState } from '@/components/infinity/EmptyState';
import { StatusBadge } from '@/components/infinity/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { useAccountingRegion } from '@/contexts/AccountingRegionContext';

const fmt = (n: any) => new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(Number(n || 0));
const kind: Record<string, any> = { entwurf: 'idle', exportiert: 'progress', eingereicht: 'progress', verbucht: 'done', storniert: 'error', aktiv: 'done', pausiert: 'idle', widerrufen: 'error' };

export default function ChLastschriften() {
  const { region } = useAccountingRegion();
  const [tab, setTab] = useState<'runs' | 'mandates'>('runs');
  const [mandates, setMandates] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mDlg, setMDlg] = useState(false);
  const [rDlg, setRDlg] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [mForm, setMForm] = useState<any>({ scheme: 'LSV+', status: 'aktiv', signed_at: today });
  const [rForm, setRForm] = useState<any>({ scheme: 'LSV+', collection_date: today });

  const load = async () => {
    setLoading(true);
    const [m, r] = await Promise.all([
      (supabase as any).from('finance_ch_dd_mandates').select('*, customer:customer_id(company_name, contact_name)').in('accounting_region', String(region) === 'ALL' ? ['EU','CH'] : [region]).order('created_at', { ascending: false }),
      (supabase as any).from('finance_ch_dd_runs').select('*').in('accounting_region', String(region) === 'ALL' ? ['EU','CH'] : [region]).order('created_at', { ascending: false }).limit(100),
    ]);
    setMandates(m.data ?? []); setRuns(r.data ?? []); setLoading(false);
  };
  useEffect(() => { load(); }, [region]);

  const saveMandate = async () => {
    if (!mForm.mandate_reference || !mForm.iban || !mForm.account_holder) {
      toast({ title: 'Pflichtfelder', description: 'Mandatsreferenz, IBAN und Kontoinhaber sind erforderlich.', variant: 'destructive' }); return;
    }
    const { error } = await (supabase as any).from('finance_ch_dd_mandates').insert({ ...mForm, accounting_region: (String(region) === 'ALL' ? 'EU' : region) });
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    setMDlg(false); setMForm({ scheme: 'LSV+', status: 'aktiv', signed_at: today }); load();
  };

  const saveRun = async () => {
    if (!rForm.creditor_name || !rForm.creditor_iban) {
      toast({ title: 'Pflichtfelder', description: 'Gläubiger-Name und -IBAN sind erforderlich.', variant: 'destructive' }); return;
    }
    const { error } = await (supabase as any).from('finance_ch_dd_runs').insert({ ...rForm, accounting_region: (String(region) === 'ALL' ? 'EU' : region) });
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    setRDlg(false); setRForm({ scheme: 'LSV+', collection_date: today }); load();
  };

  const exportRun = async (run: any) => {
    const { data, error } = await supabase.functions.invoke('finance-ch-dd-export', { body: { run_id: run.id } });
    if (error) { toast({ title: 'Export-Fehler', description: error.message, variant: 'destructive' }); return; }
    // Response is XML text (from Edge Function returning application/xml)
    const xml = typeof data === 'string' ? data : new TextDecoder().decode(data as any);
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${run.run_number}.xml`; a.click();
    URL.revokeObjectURL(url); load();
  };

  if (region !== 'CH') {
    return (
      <div className="container mx-auto px-4 py-8">
        <PageHeader icon={Landmark} title="CH Lastschriften" subtitle="Nur für Buchhaltung 🇨🇭 CH verfügbar." />
        <EmptyState icon={Landmark} title="Region wechseln" description="Bitte oben links Buchhaltung 🇨🇭 CH auswählen." />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <PageHeader icon={Landmark} title="CH Lastschriften · LSV+ / BDD" subtitle="Schweizer Lastschriftverfahren (pain.008.001.02.ch.03)"
        actions={<Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-1" />Aktualisieren</Button>}
      />

      <Tabs value={tab} onValueChange={(v: any) => setTab(v)}>
        <TabsList><TabsTrigger value="runs">Läufe</TabsTrigger><TabsTrigger value="mandates">Mandate</TabsTrigger></TabsList>

        <TabsContent value="runs" className="space-y-3">
          <div className="flex justify-end"><Button size="sm" onClick={() => setRDlg(true)}><Plus className="w-4 h-4 mr-1" />Neuer Lauf</Button></div>
          {loading ? <SkeletonTable rows={5} /> : runs.length === 0 ? (
            <EmptyState icon={Landmark} title="Keine Läufe" description="Lege einen LSV+/BDD-Lauf an." />
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr><th className="text-left p-3">Nr</th><th className="text-left p-3">Verfahren</th><th className="text-left p-3">Einzug</th><th className="text-left p-3">Gläubiger</th><th className="text-right p-3">Betrag</th><th className="text-left p-3">Status</th><th className="text-right p-3">Export</th></tr>
                </thead>
                <tbody>
                  {runs.map(r => (
                    <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                      <td className="p-3 font-mono text-xs">{r.run_number}</td>
                      <td className="p-3">{r.scheme}</td>
                      <td className="p-3">{r.collection_date}</td>
                      <td className="p-3">{r.creditor_name}</td>
                      <td className="p-3 text-right">{fmt(r.total_amount)}</td>
                      <td className="p-3"><StatusBadge kind={kind[r.status] ?? 'idle'} label={r.status} /></td>
                      <td className="p-3 text-right">
                        <Button size="sm" variant="outline" onClick={() => exportRun(r)}><Download className="w-4 h-4 mr-1" />pain.008</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="mandates" className="space-y-3">
          <div className="flex justify-end"><Button size="sm" onClick={() => setMDlg(true)}><Plus className="w-4 h-4 mr-1" />Neues Mandat</Button></div>
          {loading ? <SkeletonTable rows={5} /> : mandates.length === 0 ? (
            <EmptyState icon={Landmark} title="Keine Mandate" description="Lege ein LSV+/BDD-Mandat an." />
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr><th className="text-left p-3">Referenz</th><th className="text-left p-3">Verfahren</th><th className="text-left p-3">Kunde</th><th className="text-left p-3">IBAN</th><th className="text-left p-3">Unterschrieben</th><th className="text-left p-3">Status</th></tr>
                </thead>
                <tbody>
                  {mandates.map(m => (
                    <tr key={m.id} className="border-t border-border hover:bg-muted/20">
                      <td className="p-3 font-mono text-xs">{m.mandate_reference}</td>
                      <td className="p-3">{m.scheme}</td>
                      <td className="p-3">{m.customer?.company_name || m.customer?.contact_name || m.account_holder}</td>
                      <td className="p-3 font-mono text-xs">{m.iban}</td>
                      <td className="p-3">{m.signed_at}</td>
                      <td className="p-3"><StatusBadge kind={kind[m.status] ?? 'idle'} label={m.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Mandate dialog */}
      <Dialog open={mDlg} onOpenChange={setMDlg}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Neues LSV+/BDD-Mandat</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Mandatsreferenz *</Label><Input value={mForm.mandate_reference || ''} onChange={e => setMForm({ ...mForm, mandate_reference: e.target.value })} /></div>
            <div><Label>Verfahren</Label>
              <Select value={mForm.scheme} onValueChange={v => setMForm({ ...mForm, scheme: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="LSV+">LSV+</SelectItem><SelectItem value="BDD">BDD</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Kontoinhaber *</Label><Input value={mForm.account_holder || ''} onChange={e => setMForm({ ...mForm, account_holder: e.target.value })} /></div>
            <div className="col-span-2"><Label>IBAN *</Label><Input value={mForm.iban || ''} onChange={e => setMForm({ ...mForm, iban: e.target.value })} /></div>
            <div><Label>BIC</Label><Input value={mForm.bic || ''} onChange={e => setMForm({ ...mForm, bic: e.target.value })} /></div>
            <div><Label>Unterschriftsdatum</Label><Input type="date" value={mForm.signed_at} onChange={e => setMForm({ ...mForm, signed_at: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMDlg(false)}>Abbrechen</Button>
            <Button onClick={saveMandate}>Anlegen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Run dialog */}
      <Dialog open={rDlg} onOpenChange={setRDlg}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Neuer LSV+/BDD-Lauf</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Verfahren</Label>
              <Select value={rForm.scheme} onValueChange={v => setRForm({ ...rForm, scheme: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="LSV+">LSV+</SelectItem><SelectItem value="BDD">BDD</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Einzugsdatum</Label><Input type="date" value={rForm.collection_date} onChange={e => setRForm({ ...rForm, collection_date: e.target.value })} /></div>
            <div className="col-span-2"><Label>Gläubiger-Name *</Label><Input value={rForm.creditor_name || ''} onChange={e => setRForm({ ...rForm, creditor_name: e.target.value })} /></div>
            <div className="col-span-2"><Label>Gläubiger-IBAN *</Label><Input value={rForm.creditor_iban || ''} onChange={e => setRForm({ ...rForm, creditor_iban: e.target.value })} /></div>
            <div><Label>Gläubiger-BIC</Label><Input value={rForm.creditor_bic || ''} onChange={e => setRForm({ ...rForm, creditor_bic: e.target.value })} /></div>
            <div><Label>Creditor-ID</Label><Input value={rForm.creditor_id || ''} onChange={e => setRForm({ ...rForm, creditor_id: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRDlg(false)}>Abbrechen</Button>
            <Button onClick={saveRun}>Lauf anlegen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
