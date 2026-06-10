import { useEffect, useState } from 'react';
import { Plus, Download, Trash2, FileText, Banknote, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, PageLoading, DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

const fmt = (n: number | null | undefined) => typeof n === 'number'
  ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n) : '–';

const statusVariant = (s: string): any => ({
  entwurf: 'secondary', exportiert: 'default', eingereicht: 'default', verbucht: 'default',
  storniert: 'destructive', aktiv: 'default', pausiert: 'secondary', widerrufen: 'destructive',
}[s] ?? 'secondary');

export default function FinanceSepa() {
  const { roles } = useAuth();
  const isSuperAdmin = roles.includes('Super Admin');
  const [tab, setTab] = useState<'runs' | 'mandates'>('runs');
  const [loading, setLoading] = useState(true);
  const [mandates, setMandates] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [mDlg, setMDlg] = useState(false);
  const [mForm, setMForm] = useState<any>({ scheme: 'CORE', sequence_type: 'RCUR', status: 'aktiv', signed_at: new Date().toISOString().slice(0, 10) });
  const [rDlg, setRDlg] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [rForm, setRForm] = useState<any>({ execution_date: today, collection_date: today });
  const [activeRun, setActiveRun] = useState<any>(null);
  const [runItems, setRunItems] = useState<any[]>([]);
  const [openTx, setOpenTx] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    const [m, r, c, t] = await Promise.all([
      supabase.from('finance_sepa_mandates' as any).select('*, customer:customer_id(company_name, contact_name)').order('created_at', { ascending: false }),
      supabase.from('finance_sepa_runs' as any).select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('customers').select('id, company_name, contact_name').order('company_name').limit(1000),
      supabase.from('tenants').select('id, name, flag_emoji').eq('is_active', true).order('sort_order'),
    ]);
    setMandates(m.data ?? []);
    setRuns(r.data ?? []);
    setCustomers(c.data ?? []);
    setTenants(t.data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const loadRunDetail = async (run: any) => {
    setActiveRun(run);
    const { data } = await supabase.from('finance_sepa_run_items' as any)
      .select('*, mandate:mandate_id(mandate_reference, iban, account_holder), customer:customer_id(company_name, contact_name)')
      .eq('run_id', run.id);
    setRunItems(data ?? []);
    // open invoices: finance_transactions of type Rechnung not yet on any run
    const { data: tx } = await supabase.from('finance_transactions')
      .select('id, customer_id, amount, reference, booking_date, transaction_type')
      .eq('transaction_type', 'Rechnung')
      .order('booking_date', { ascending: false })
      .limit(500);
    setOpenTx(tx ?? []);
  };

  const saveMandate = async () => {
    if (!mForm.customer_id || !mForm.iban || !mForm.mandate_reference) {
      toast({ title: 'Fehlende Felder', description: 'Kunde, IBAN und Mandatsreferenz sind Pflicht', variant: 'destructive' });
      return;
    }
    const payload = { ...mForm, iban: mForm.iban.replace(/\s+/g, '').toUpperCase() };
    const { error } = mForm.id
      ? await supabase.from('finance_sepa_mandates' as any).update(payload).eq('id', mForm.id)
      : await supabase.from('finance_sepa_mandates' as any).insert(payload);
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Gespeichert' });
    setMDlg(false); setMForm({ scheme: 'CORE', sequence_type: 'RCUR', status: 'aktiv', signed_at: today });
    load();
  };

  const deleteMandate = async (id: string) => {
    if (!confirm('Mandat löschen?')) return;
    const { error } = await supabase.from('finance_sepa_mandates' as any).delete().eq('id', id);
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    load();
  };

  const createRun = async () => {
    if (!rForm.creditor_name || !rForm.creditor_iban || !rForm.creditor_id) {
      toast({ title: 'Fehlende Felder', description: 'Gläubiger-Name, IBAN und Gläubiger-ID sind Pflicht', variant: 'destructive' });
      return;
    }
    const { data, error } = await supabase.from('finance_sepa_runs' as any).insert({ ...rForm }).select().single();
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    setRDlg(false);
    load();
    loadRunDetail(data);
  };

  const addItemToRun = async (mandateId: string, customerId: string, amount: number, reference: string, transactionId?: string) => {
    const { error } = await supabase.from('finance_sepa_run_items' as any).insert({
      run_id: activeRun.id,
      mandate_id: mandateId,
      customer_id: customerId,
      transaction_id: transactionId ?? null,
      amount,
      reference,
      remittance_info: reference,
    });
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    loadRunDetail(activeRun);
  };

  const removeItem = async (id: string) => {
    const { error } = await supabase.from('finance_sepa_run_items' as any).delete().eq('id', id);
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    loadRunDetail(activeRun);
  };

  const exportXml = async (runId: string) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/finance-sepa-export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ run_id: runId }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const run = runs.find(r => r.id === runId);
      a.download = `${run?.run_number ?? 'SEPA'}.xml`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast({ title: 'XML exportiert' });
      load();
    } catch (e: any) {
      toast({ title: 'Export-Fehler', description: e?.message, variant: 'destructive' });
    }
  };

  const deleteRun = async (id: string) => {
    if (!confirm('Lauf löschen?')) return;
    const { error } = await supabase.from('finance_sepa_runs' as any).delete().eq('id', id);
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    if (activeRun?.id === id) { setActiveRun(null); setRunItems([]); }
    load();
  };

  if (loading) return <PageLoading />;

  return (
    <div className="space-y-6">
      <PageHeader title="SEPA Lastschriften" subtitle="Mandate verwalten und pain.008-XML-Lastschriftläufe erstellen" icon={Banknote} />

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="runs">Lastschriftläufe ({runs.length})</TabsTrigger>
          <TabsTrigger value="mandates">Mandate ({mandates.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="runs" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setRDlg(true)}><Plus className="h-4 w-4 mr-2" />Neuer Lauf</Button>
          </div>

          <DataCard title="Läufe">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left border-b border-border">
                  <th className="p-2">Nummer</th><th className="p-2">Ausführung</th><th className="p-2">Fälligkeit</th>
                  <th className="p-2">Gläubiger</th><th className="p-2">Positionen</th><th className="p-2">Summe</th>
                  <th className="p-2">Status</th><th className="p-2"></th>
                </tr></thead>
                <tbody>
                  {runs.map(r => (
                    <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30 cursor-pointer" onClick={() => loadRunDetail(r)}>
                      <td className="p-2 font-mono">{r.run_number}</td>
                      <td className="p-2">{r.execution_date}</td>
                      <td className="p-2">{r.collection_date}</td>
                      <td className="p-2">{r.creditor_name}</td>
                      <td className="p-2">{r.item_count}</td>
                      <td className="p-2">{fmt(Number(r.total_amount))}</td>
                      <td className="p-2"><Badge variant={statusVariant(r.status)}>{r.status}</Badge></td>
                      <td className="p-2 flex gap-1" onClick={e => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" onClick={() => exportXml(r.id)} disabled={r.item_count === 0}><Download className="h-4 w-4" /></Button>
                        {isSuperAdmin && <Button size="sm" variant="ghost" onClick={() => deleteRun(r.id)}><Trash2 className="h-4 w-4" /></Button>}
                      </td>
                    </tr>
                  ))}
                  {runs.length === 0 && <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">Keine Läufe vorhanden</td></tr>}
                </tbody>
              </table>
            </div>
          </DataCard>

          {activeRun && (
            <DataCard title={`Positionen – ${activeRun.run_number}`}>
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left border-b border-border">
                      <th className="p-2">Kunde</th><th className="p-2">Mandat</th><th className="p-2">IBAN</th>
                      <th className="p-2">Referenz</th><th className="p-2">Betrag</th><th className="p-2">Status</th><th></th>
                    </tr></thead>
                    <tbody>
                      {runItems.map(it => (
                        <tr key={it.id} className="border-b border-border/50">
                          <td className="p-2">{it.customer?.company_name || it.customer?.contact_name}</td>
                          <td className="p-2 font-mono text-xs">{it.mandate?.mandate_reference}</td>
                          <td className="p-2 font-mono text-xs">{it.mandate?.iban}</td>
                          <td className="p-2">{it.reference}</td>
                          <td className="p-2">{fmt(Number(it.amount))}</td>
                          <td className="p-2"><Badge variant={statusVariant(it.status)}>{it.status}</Badge></td>
                          <td className="p-2">
                            {activeRun.status === 'entwurf' && (
                              <Button size="sm" variant="ghost" onClick={() => removeItem(it.id)}><X className="h-4 w-4" /></Button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {runItems.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Noch keine Positionen</td></tr>}
                    </tbody>
                  </table>
                </div>

                {activeRun.status === 'entwurf' && (
                  <div>
                    <div className="text-sm font-medium mb-2">Offene Rechnungen mit aktivem Mandat hinzufügen</div>
                    <div className="overflow-x-auto max-h-96 overflow-y-auto border border-border rounded">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-card"><tr className="text-left border-b border-border">
                          <th className="p-2">Datum</th><th className="p-2">Kunde</th><th className="p-2">Referenz</th>
                          <th className="p-2">Betrag</th><th></th>
                        </tr></thead>
                        <tbody>
                          {openTx.filter(tx => {
                            const m = mandates.find(mm => mm.customer_id === tx.customer_id && mm.status === 'aktiv');
                            const already = runItems.some(it => it.transaction_id === tx.id);
                            return m && !already;
                          }).slice(0, 100).map(tx => {
                            const m = mandates.find(mm => mm.customer_id === tx.customer_id && mm.status === 'aktiv');
                            const c = customers.find(cc => cc.id === tx.customer_id);
                            return (
                              <tr key={tx.id} className="border-b border-border/50">
                                <td className="p-2">{tx.booking_date}</td>
                                <td className="p-2">{c?.company_name || c?.contact_name}</td>
                                <td className="p-2">{tx.reference}</td>
                                <td className="p-2">{fmt(Number(tx.amount))}</td>
                                <td className="p-2">
                                  <Button size="sm" onClick={() => addItemToRun(m.id, tx.customer_id, Number(tx.amount), tx.reference ?? '', tx.id)}>
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </DataCard>
          )}
        </TabsContent>

        <TabsContent value="mandates" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setMForm({ scheme: 'CORE', sequence_type: 'RCUR', status: 'aktiv', signed_at: today }); setMDlg(true); }}>
              <Plus className="h-4 w-4 mr-2" />Neues Mandat
            </Button>
          </div>
          <DataCard title="Mandate">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left border-b border-border">
                  <th className="p-2">Mandatsreferenz</th><th className="p-2">Kunde</th><th className="p-2">IBAN</th>
                  <th className="p-2">Schema</th><th className="p-2">Sequenz</th><th className="p-2">Unterschrieben</th>
                  <th className="p-2">Status</th><th></th>
                </tr></thead>
                <tbody>
                  {mandates.map(m => (
                    <tr key={m.id} className="border-b border-border/50">
                      <td className="p-2 font-mono">{m.mandate_reference}</td>
                      <td className="p-2">{m.customer?.company_name || m.customer?.contact_name}</td>
                      <td className="p-2 font-mono text-xs">{m.iban}</td>
                      <td className="p-2">{m.scheme}</td>
                      <td className="p-2">{m.sequence_type}</td>
                      <td className="p-2">{m.signed_at}</td>
                      <td className="p-2"><Badge variant={statusVariant(m.status)}>{m.status}</Badge></td>
                      <td className="p-2 flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => { setMForm(m); setMDlg(true); }}><FileText className="h-4 w-4" /></Button>
                        {isSuperAdmin && <Button size="sm" variant="ghost" onClick={() => deleteMandate(m.id)}><Trash2 className="h-4 w-4" /></Button>}
                      </td>
                    </tr>
                  ))}
                  {mandates.length === 0 && <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">Keine Mandate vorhanden</td></tr>}
                </tbody>
              </table>
            </div>
          </DataCard>
        </TabsContent>
      </Tabs>

      <Dialog open={mDlg} onOpenChange={setMDlg}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{mForm.id ? 'Mandat bearbeiten' : 'Neues Mandat'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Kunde *</Label>
              <Select value={mForm.customer_id ?? ''} onValueChange={v => setMForm({ ...mForm, customer_id: v })}>
                <SelectTrigger><SelectValue placeholder="Kunde auswählen" /></SelectTrigger>
                <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name || c.contact_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Mandatsreferenz *</Label><Input value={mForm.mandate_reference ?? ''} onChange={e => setMForm({ ...mForm, mandate_reference: e.target.value })} /></div>
            <div><Label>Unterschriftsdatum *</Label><Input type="date" value={mForm.signed_at ?? ''} onChange={e => setMForm({ ...mForm, signed_at: e.target.value })} /></div>
            <div><Label>IBAN *</Label><Input value={mForm.iban ?? ''} onChange={e => setMForm({ ...mForm, iban: e.target.value })} /></div>
            <div><Label>BIC</Label><Input value={mForm.bic ?? ''} onChange={e => setMForm({ ...mForm, bic: e.target.value })} /></div>
            <div className="col-span-2"><Label>Kontoinhaber</Label><Input value={mForm.account_holder ?? ''} onChange={e => setMForm({ ...mForm, account_holder: e.target.value })} /></div>
            <div>
              <Label>Schema</Label>
              <Select value={mForm.scheme} onValueChange={v => setMForm({ ...mForm, scheme: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="CORE">CORE</SelectItem><SelectItem value="B2B">B2B</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sequenztyp</Label>
              <Select value={mForm.sequence_type} onValueChange={v => setMForm({ ...mForm, sequence_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FRST">FRST (Erstlastschrift)</SelectItem>
                  <SelectItem value="RCUR">RCUR (Folgelastschrift)</SelectItem>
                  <SelectItem value="OOFF">OOFF (Einmalig)</SelectItem>
                  <SelectItem value="FNAL">FNAL (Letzte)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={mForm.status} onValueChange={v => setMForm({ ...mForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aktiv">aktiv</SelectItem>
                  <SelectItem value="pausiert">pausiert</SelectItem>
                  <SelectItem value="widerrufen">widerrufen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Notizen</Label><Input value={mForm.notes ?? ''} onChange={e => setMForm({ ...mForm, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMDlg(false)}>Abbrechen</Button>
            <Button onClick={saveMandate}><Check className="h-4 w-4 mr-2" />Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rDlg} onOpenChange={setRDlg}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Neuer SEPA-Lauf</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Mandant</Label>
              <Select value={rForm.tenant_id ?? ''} onValueChange={v => {
                const t = tenants.find(tt => tt.id === v);
                setRForm({ ...rForm, tenant_id: v, source_system: t?.id ? undefined : rForm.source_system });
              }}>
                <SelectTrigger><SelectValue placeholder="Mandant wählen" /></SelectTrigger>
                <SelectContent>{tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.flag_emoji} {t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Ausführungsdatum</Label><Input type="date" value={rForm.execution_date} onChange={e => setRForm({ ...rForm, execution_date: e.target.value })} /></div>
            <div><Label>Fälligkeitsdatum</Label><Input type="date" value={rForm.collection_date} onChange={e => setRForm({ ...rForm, collection_date: e.target.value })} /></div>
            <div className="col-span-2"><Label>Gläubiger-Name *</Label><Input value={rForm.creditor_name ?? ''} onChange={e => setRForm({ ...rForm, creditor_name: e.target.value })} /></div>
            <div><Label>Gläubiger-IBAN *</Label><Input value={rForm.creditor_iban ?? ''} onChange={e => setRForm({ ...rForm, creditor_iban: e.target.value })} /></div>
            <div><Label>Gläubiger-BIC</Label><Input value={rForm.creditor_bic ?? ''} onChange={e => setRForm({ ...rForm, creditor_bic: e.target.value })} /></div>
            <div className="col-span-2"><Label>Gläubiger-ID *</Label><Input placeholder="DE98ZZZ09999999999" value={rForm.creditor_id ?? ''} onChange={e => setRForm({ ...rForm, creditor_id: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRDlg(false)}>Abbrechen</Button>
            <Button onClick={createRun}><Check className="h-4 w-4 mr-2" />Anlegen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
