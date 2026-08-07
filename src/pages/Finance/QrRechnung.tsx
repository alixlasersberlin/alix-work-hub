import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, Plus, RefreshCw, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { SkeletonTable } from '@/components/infinity/Skeleton';
import { EmptyState } from '@/components/infinity/EmptyState';
import { StatusBadge } from '@/components/infinity/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { useAccountingRegion } from '@/contexts/AccountingRegionContext';

const fmt = (n: any, cur = 'CHF') => Number.isFinite(Number(n))
  ? new Intl.NumberFormat('de-CH', { style: 'currency', currency: cur }).format(Number(n)) : '–';

const statusKind: Record<string, any> = {
  entwurf: 'idle', erstellt: 'progress', versendet: 'progress', bezahlt: 'done', storniert: 'error',
};

const empty = {
  amount: '', currency: 'CHF', qr_iban: '', creditor_name: '', creditor_street: '', creditor_house_no: '',
  creditor_postal_code: '', creditor_city: '', creditor_country: 'CH',
  debtor_name: '', debtor_street: '', debtor_house_no: '', debtor_postal_code: '', debtor_city: '', debtor_country: 'CH',
  reference_type: 'QRR', unstructured_message: '', bill_info: '', due_date: '', invoice_number: '',
};

export default function QrRechnung() {
  const { region } = useAccountingRegion();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dlg, setDlg] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [saving, setSaving] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{ png: string; payload: string; reference: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any).from('finance_qr_invoices')
      .select('*').in('accounting_region', region === 'ALL' ? ['EU','CH'] : [region])
      .order('created_at', { ascending: false }).limit(500);
    setRows(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [region]);

  const submit = async () => {
    if (!form.amount || !form.qr_iban || !form.creditor_name) {
      toast({ title: 'Pflichtfelder', description: 'Betrag, QR-IBAN und Gläubiger sind erforderlich.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = { ...form, amount: Number(form.amount), due_date: form.due_date || null, accounting_region: (region === 'ALL' ? 'EU' : region) };
    const { error } = await (supabase as any).from('finance_qr_invoices').insert(payload);
    setSaving(false);
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'QR-Rechnung angelegt' });
    setDlg(false); setForm(empty); load();
  };

  const generate = async (row: any) => {
    setPreviewId(row.id); setPreviewData(null);
    const { data, error } = await supabase.functions.invoke('finance-qr-generate', { body: { id: row.id } });
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    const png = await QRCode.toDataURL((data as any).payload, { errorCorrectionLevel: 'M', margin: 1, width: 320 });
    setPreviewData({ png, payload: (data as any).payload, reference: (data as any).reference });
    load();
  };

  if (region !== 'CH') {
    return (
      <div className="container mx-auto px-4 py-8">
        <PageHeader icon={QrCode} title="QR-Rechnung" subtitle="Nur für Buchhaltung 🇨🇭 CH verfügbar." />
        <EmptyState icon={QrCode} title="Region wechseln" description="Bitte oben links Buchhaltung 🇨🇭 CH auswählen." />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <PageHeader
        icon={QrCode}
        title="QR-Rechnung · 🇨🇭 CH"
        subtitle="Schweizer QR-Rechnungen mit QR-IBAN, Referenz (QRR/SCOR/NON) und Payload-Vorschau"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-1" />Aktualisieren</Button>
            <Button size="sm" onClick={() => setDlg(true)}><Plus className="w-4 h-4 mr-1" />Neue QR-Rechnung</Button>
          </div>
        }
      />

      {loading ? <SkeletonTable rows={6} /> : rows.length === 0 ? (
        <EmptyState icon={QrCode} title="Noch keine QR-Rechnungen" description="Lege deine erste QR-Rechnung an." />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left p-3">Nr</th>
                <th className="text-left p-3">Gläubiger</th>
                <th className="text-left p-3">Schuldner</th>
                <th className="text-right p-3">Betrag</th>
                <th className="text-left p-3">Referenz</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                  <td className="p-3 font-mono text-xs">{r.invoice_number || r.id.slice(0, 8)}</td>
                  <td className="p-3">{r.creditor_name}</td>
                  <td className="p-3">{r.debtor_name || <span className="text-muted-foreground">—</span>}</td>
                  <td className="p-3 text-right font-medium">{fmt(r.amount, r.currency)}</td>
                  <td className="p-3 font-mono text-xs">
                    <Badge variant="outline" className="mr-2">{r.reference_type}</Badge>
                    {r.reference ? r.reference.replace(/(\d{5})/g, '$1 ').trim() : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="p-3"><StatusBadge kind={statusKind[r.status] ?? 'idle'} label={r.status} /></td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => generate(r)}><QrCode className="w-4 h-4 mr-1" />QR</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={dlg} onOpenChange={setDlg}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Neue QR-Rechnung</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Rechnungs-Nr</Label><Input value={form.invoice_number} onChange={e => setForm({ ...form, invoice_number: e.target.value })} /></div>
            <div><Label>Fälligkeit</Label><Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
            <div><Label>Betrag *</Label><Input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
            <div><Label>Währung</Label>
              <Select value={form.currency} onValueChange={v => setForm({ ...form, currency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="CHF">CHF</SelectItem><SelectItem value="EUR">EUR</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>QR-IBAN *</Label><Input placeholder="CH44 3199 9123 0008 8901 2" value={form.qr_iban} onChange={e => setForm({ ...form, qr_iban: e.target.value })} /></div>
            <div className="col-span-2"><Label>Gläubiger Name *</Label><Input value={form.creditor_name} onChange={e => setForm({ ...form, creditor_name: e.target.value })} /></div>
            <div><Label>Strasse</Label><Input value={form.creditor_street} onChange={e => setForm({ ...form, creditor_street: e.target.value })} /></div>
            <div><Label>Nr</Label><Input value={form.creditor_house_no} onChange={e => setForm({ ...form, creditor_house_no: e.target.value })} /></div>
            <div><Label>PLZ</Label><Input value={form.creditor_postal_code} onChange={e => setForm({ ...form, creditor_postal_code: e.target.value })} /></div>
            <div><Label>Ort</Label><Input value={form.creditor_city} onChange={e => setForm({ ...form, creditor_city: e.target.value })} /></div>
            <div><Label>Referenztyp</Label>
              <Select value={form.reference_type} onValueChange={v => setForm({ ...form, reference_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="QRR">QRR (Schweizer QR-Referenz)</SelectItem>
                  <SelectItem value="SCOR">SCOR (Creditor Reference)</SelectItem>
                  <SelectItem value="NON">Ohne Referenz</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Schuldner Name</Label><Input value={form.debtor_name} onChange={e => setForm({ ...form, debtor_name: e.target.value })} /></div>
            <div className="col-span-2"><Label>Mitteilung</Label><Input value={form.unstructured_message} onChange={e => setForm({ ...form, unstructured_message: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlg(false)}>Abbrechen</Button>
            <Button onClick={submit} disabled={saving}>{saving ? 'Speichere…' : 'Anlegen'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR preview dialog */}
      <Dialog open={!!previewId} onOpenChange={() => { setPreviewId(null); setPreviewData(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>QR-Code</DialogTitle></DialogHeader>
          {!previewData ? (
            <div className="text-sm text-muted-foreground py-8 text-center">QR wird erzeugt…</div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-center bg-white p-4 rounded-lg">
                <img src={previewData.png} alt="QR-Code" className="w-64 h-64" />
              </div>
              <div className="text-xs">
                <div className="text-muted-foreground mb-1">Referenz</div>
                <div className="font-mono">{previewData.reference.replace(/(\d{5})/g, '$1 ').trim()}</div>
              </div>
              <div className="text-xs">
                <div className="text-muted-foreground mb-1">SPC-Payload</div>
                <pre className="font-mono text-[10px] whitespace-pre-wrap bg-muted/40 p-2 rounded max-h-40 overflow-auto">{previewData.payload}</pre>
              </div>
              <Button variant="outline" size="sm" onClick={() => {
                const a = document.createElement('a'); a.href = previewData.png;
                a.download = `qr-${previewData.reference || 'code'}.png`; a.click();
              }}><Download className="w-4 h-4 mr-1" />PNG herunterladen</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
