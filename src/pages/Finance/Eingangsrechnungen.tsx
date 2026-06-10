import { useEffect, useRef, useState } from 'react';
import { Inbox, Upload, Download, CheckCircle2, XCircle, Eye, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, PageLoading, DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

const STATUSES = ['erfasst','geprueft','freigegeben','bezahlt','abgelehnt','storniert'] as const;
type Status = typeof STATUSES[number];

const statusClass = (s: string) => ({
  erfasst:    'bg-amber-500/15 text-amber-500 border-amber-500/30',
  geprueft:   'bg-blue-500/15 text-blue-500 border-blue-500/30',
  freigegeben:'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  bezahlt:    'bg-emerald-700/15 text-emerald-600 border-emerald-700/30',
  abgelehnt:  'bg-destructive/15 text-destructive border-destructive/30',
  storniert:  'bg-muted text-muted-foreground',
}[s] ?? 'bg-muted');

const fmt = (n: number | null | undefined, c = 'EUR') =>
  n != null ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: c }).format(Number(n)) : '–';

export default function FinanceEingangsrechnungen() {
  const { roles } = useAuth();
  const canApprove = roles.includes('Super Admin') || roles.includes('Geschäftsführung');
  const isSuperAdmin = roles.includes('Super Admin');
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'alle' | Status>('alle');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState<any>({ supplier_name: '', invoice_number: '', invoice_date: new Date().toISOString().slice(0, 10), due_date: '', amount_gross: '', amount_net: '', amount_tax: '', tax_rate: '19', description: '' });
  const [parseHint, setParseHint] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase.from('finance_incoming_invoices' as any).select('*').order('invoice_date', { ascending: false }).limit(300);
    if (statusFilter !== 'alle') q = q.eq('status', statusFilter);
    const { data, error } = await q;
    if (error) toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    setRows((data ?? []) as any[]);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [statusFilter]);

  const onXmlFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const xml = await file.text();
      const { data, error } = await supabase.functions.invoke('finance-einvoice-parse', { body: { xml } });
      if (error) throw error;
      setParseHint(data);
      setForm((f: any) => ({
        ...f,
        supplier_name: data.supplier_name ?? f.supplier_name,
        supplier_vat_id: data.supplier_vat_id ?? '',
        invoice_number: data.invoice_number ?? f.invoice_number,
        invoice_date: data.invoice_date ?? f.invoice_date,
        due_date: data.due_date ?? f.due_date,
        amount_gross: data.amount_gross ?? f.amount_gross,
        amount_net: data.amount_net ?? f.amount_net,
        amount_tax: data.amount_tax ?? f.amount_tax,
        tax_rate: data.tax_rate ?? f.tax_rate,
        currency: data.currency ?? 'EUR',
        _xml_file: file,
        _xml_text: xml,
      }));
      setShowNew(true);
      toast({ title: 'XML erkannt', description: `Format: ${data.format}` });
    } catch (err: any) {
      toast({ title: 'Parse-Fehler', description: err?.message, variant: 'destructive' });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const save = async () => {
    if (!form.supplier_name || !form.invoice_number || !form.invoice_date || !form.amount_gross) {
      toast({ title: 'Pflichtfelder fehlen', description: 'Lieferant, Rechnungsnr., Datum, Brutto', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      let xml_path: string | undefined;
      if (form._xml_file) {
        const path = `eingangsrechnungen/xml/${Date.now()}-${form._xml_file.name.replace(/[^A-Za-z0-9._-]/g, '_')}`;
        const up = await supabase.storage.from('finance-documents').upload(path, form._xml_file, { contentType: 'application/xml' });
        if (up.error) throw up.error;
        xml_path = path;
      }
      const { error } = await supabase.from('finance_incoming_invoices' as any).insert({
        supplier_name: form.supplier_name,
        supplier_vat_id: form.supplier_vat_id || null,
        invoice_number: form.invoice_number,
        invoice_date: form.invoice_date,
        due_date: form.due_date || null,
        amount_gross: Number(form.amount_gross),
        amount_net: form.amount_net ? Number(form.amount_net) : null,
        amount_tax: form.amount_tax ? Number(form.amount_tax) : null,
        tax_rate: form.tax_rate ? Number(form.tax_rate) : null,
        currency: form.currency || 'EUR',
        description: form.description || null,
        xml_path,
        is_einvoice: !!form._xml_file,
        einvoice_format: parseHint?.format ?? null,
        parsed_data: parseHint ?? null,
        status: 'erfasst',
      });
      if (error) throw error;
      toast({ title: 'Eingangsrechnung erfasst' });
      setShowNew(false);
      setForm({ supplier_name: '', invoice_number: '', invoice_date: new Date().toISOString().slice(0, 10), due_date: '', amount_gross: '', amount_net: '', amount_tax: '', tax_rate: '19', description: '' });
      setParseHint(null);
      load();
    } catch (err: any) {
      toast({ title: 'Speicher-Fehler', description: err?.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (row: any, status: Status) => {
    const patch: any = { status };
    if (status === 'geprueft') { patch.reviewed_at = new Date().toISOString(); }
    if (status === 'freigegeben') { patch.approved_at = new Date().toISOString(); }
    if (status === 'bezahlt') { patch.paid_at = new Date().toISOString().slice(0, 10); }
    const { error } = await supabase.from('finance_incoming_invoices' as any).update(patch).eq('id', row.id);
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    toast({ title: `Status: ${status}` });
    load();
  };

  const downloadXml = async (row: any) => {
    if (!row.xml_path) return;
    const { data, error } = await supabase.storage.from('finance-documents').createSignedUrl(row.xml_path, 300);
    if (error || !data?.signedUrl) { toast({ title: 'Fehler', description: error?.message, variant: 'destructive' }); return; }
    window.open(data.signedUrl, '_blank');
  };

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        icon={<Inbox className="w-6 h-6 text-primary" />}
        title="Eingangsrechnungen"
        subtitle="Kreditoren-Light mit XRechnung/ZUGFeRD-Erkennung und Freigabe-Workflow"
        actions={
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept=".xml" hidden onChange={onXmlFile} />
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
              <Sparkles className="w-4 h-4 mr-2" />XML einlesen
            </Button>
            <Button onClick={() => { setParseHint(null); setShowNew(true); }} className="gold-gradient text-primary-foreground">
              <Upload className="w-4 h-4 mr-2" />Neu erfassen
            </Button>
          </div>
        }
      />

      <DataCard className="p-3 mb-4 flex gap-2 flex-wrap">
        {(['alle', ...STATUSES] as const).map(s => (
          <Button key={s} size="sm" variant={statusFilter === s ? 'default' : 'outline'} onClick={() => setStatusFilter(s)}>{s}</Button>
        ))}
      </DataCard>

      <DataCard className="overflow-hidden">
        {loading ? <PageLoading /> : rows.length === 0 ? (
          <div className="text-center text-muted-foreground py-16">Keine Eingangsrechnungen.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="text-left px-4 py-3">Interne Nr.</th>
                  <th className="text-left px-4 py-3">Lieferant</th>
                  <th className="text-left px-4 py-3">Rechnung</th>
                  <th className="text-left px-4 py-3">Datum</th>
                  <th className="text-left px-4 py-3">Fällig</th>
                  <th className="text-right px-4 py-3">Brutto</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-4 py-3 font-mono text-xs">{r.internal_number}</td>
                    <td className="px-4 py-3">{r.supplier_name}{r.is_einvoice && <Badge className="ml-2" variant="outline">E-Rechnung</Badge>}</td>
                    <td className="px-4 py-3 text-xs">{r.invoice_number}</td>
                    <td className="px-4 py-3 text-xs">{r.invoice_date}</td>
                    <td className="px-4 py-3 text-xs">{r.due_date ?? '–'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmt(r.amount_gross, r.currency)}</td>
                    <td className="px-4 py-3"><Badge className={statusClass(r.status)}>{r.status}</Badge></td>
                    <td className="px-4 py-3 text-right space-x-1">
                      {r.xml_path && <Button size="sm" variant="ghost" onClick={() => downloadXml(r)}><Download className="w-3.5 h-3.5" /></Button>}
                      {r.status === 'erfasst' && (
                        <Button size="sm" variant="ghost" onClick={() => setStatus(r, 'geprueft')}><Eye className="w-3.5 h-3.5 mr-1" />Prüfen</Button>
                      )}
                      {r.status === 'geprueft' && canApprove && (
                        <Button size="sm" variant="ghost" onClick={() => setStatus(r, 'freigegeben')} className="text-emerald-500"><CheckCircle2 className="w-3.5 h-3.5 mr-1" />Freigeben</Button>
                      )}
                      {r.status === 'freigegeben' && (
                        <Button size="sm" variant="ghost" onClick={() => setStatus(r, 'bezahlt')}>Bezahlt</Button>
                      )}
                      {['erfasst','geprueft'].includes(r.status) && (
                        <Button size="sm" variant="ghost" onClick={() => setStatus(r, 'abgelehnt')} className="text-destructive"><XCircle className="w-3.5 h-3.5" /></Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Eingangsrechnung erfassen</DialogTitle></DialogHeader>
          {parseHint && (
            <div className="bg-muted/40 rounded p-3 text-xs">
              <div className="font-semibold mb-1">Automatisch erkannt ({parseHint.format})</div>
              <div className="text-muted-foreground">Bitte Werte prüfen und ggf. korrigieren.</div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 text-xs"><span className="text-muted-foreground">Lieferant *</span><Input value={form.supplier_name} onChange={e => setForm({ ...form, supplier_name: e.target.value })} /></label>
            <label className="text-xs"><span className="text-muted-foreground">USt-ID</span><Input value={form.supplier_vat_id ?? ''} onChange={e => setForm({ ...form, supplier_vat_id: e.target.value })} /></label>
            <label className="text-xs"><span className="text-muted-foreground">Rechnungsnummer *</span><Input value={form.invoice_number} onChange={e => setForm({ ...form, invoice_number: e.target.value })} /></label>
            <label className="text-xs"><span className="text-muted-foreground">Rechnungsdatum *</span><Input type="date" value={form.invoice_date} onChange={e => setForm({ ...form, invoice_date: e.target.value })} /></label>
            <label className="text-xs"><span className="text-muted-foreground">Fälligkeit</span><Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></label>
            <label className="text-xs"><span className="text-muted-foreground">Brutto *</span><Input type="number" step="0.01" value={form.amount_gross} onChange={e => setForm({ ...form, amount_gross: e.target.value })} /></label>
            <label className="text-xs"><span className="text-muted-foreground">Netto</span><Input type="number" step="0.01" value={form.amount_net} onChange={e => setForm({ ...form, amount_net: e.target.value })} /></label>
            <label className="text-xs"><span className="text-muted-foreground">USt-Betrag</span><Input type="number" step="0.01" value={form.amount_tax} onChange={e => setForm({ ...form, amount_tax: e.target.value })} /></label>
            <label className="text-xs"><span className="text-muted-foreground">USt-Satz %</span><Input type="number" step="0.01" value={form.tax_rate} onChange={e => setForm({ ...form, tax_rate: e.target.value })} /></label>
            <label className="col-span-2 text-xs"><span className="text-muted-foreground">Beschreibung</span><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Abbrechen</Button>
            <Button onClick={save} disabled={busy} className="gold-gradient text-primary-foreground">{busy ? 'Speichere…' : 'Speichern'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
