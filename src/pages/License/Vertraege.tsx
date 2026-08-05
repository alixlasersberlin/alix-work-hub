import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PageHeader } from '@/components/infinity/PageHeader';
import { FileSignature, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLicense } from '@/hooks/useLicense';

const EMPTY = {
  licensee_tenant_id: '', brand_id: '', start_date: '', end_date: '', license_model: 'percent',
  royalty_percent: 5, rate_per_unit: 0, minimum_royalty: 0, payment_terms_days: 14,
  auto_renew: true, billing_mode: 'monthly', status: 'aktiv', document_url: '', notes: '',
};

export default function LicenseVertraege() {
  const { licensor, licensees, tenants, canWrite } = useLicense();
  const [rows, setRows] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(EMPTY);

  const load = async () => {
    setBusy(true);
    const [{ data }, { data: b }] = await Promise.all([
      supabase.from('license_contracts' as any).select('*').order('created_at', { ascending: false }),
      supabase.from('brand_registry' as any).select('id,name').order('name'),
    ]);
    setRows(((data as any[]) || []));
    setBrands(((b as any[]) || []));
    setBusy(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.licensee_tenant_id) { toast.error('Bitte einen Lizenznehmer wählen.'); return; }
    const payload: any = {
      ...form,
      brand_id: form.brand_id || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      licensor_tenant_id: licensor?.id ?? null,
      royalty_percent: Number(form.royalty_percent || 0),
      rate_per_unit: Number(form.rate_per_unit || 0),
      minimum_royalty: Number(form.minimum_royalty || 0),
      payment_terms_days: Number(form.payment_terms_days || 14),
    };
    const { error } = editId
      ? await supabase.from('license_contracts' as any).update(payload).eq('id', editId)
      : await supabase.from('license_contracts' as any).insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success('Lizenzvertrag gespeichert.');
    setOpen(false); setEditId(null); setForm(EMPTY); load();
  };

  const tName = (id: string) => tenants.find((t) => t.id === id)?.name || '–';

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Lizenzverträge"
        subtitle="Markenlizenzverträge zwischen Alix License und den Mandanten"
        icon={FileSignature}
        actions={canWrite && (
          <Button onClick={() => { setEditId(null); setForm(EMPTY); setOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Neuer Vertrag
          </Button>
        )}
      />

      <Card className="p-4">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : (
          <div className="space-y-2 text-sm">
            {rows.map((c) => (
              <button key={c.id} onClick={() => { if (!canWrite) return; setEditId(c.id); setForm({ ...EMPTY, ...c, brand_id: c.brand_id || '', start_date: c.start_date || '', end_date: c.end_date || '' }); setOpen(true); }}
                className="grid w-full grid-cols-2 items-center gap-2 border-b border-border/50 pb-2 text-left hover:opacity-80 md:grid-cols-6">
                <span className="font-mono text-xs">{c.contract_number}</span>
                <span className="font-medium">{tName(c.licensee_tenant_id)}</span>
                <span>{Number(c.royalty_percent || 0)} %</span>
                <span className="text-muted-foreground">{c.start_date || '–'} → {c.end_date || 'unbefristet'}</span>
                <span className="text-muted-foreground">{c.billing_mode === 'single' ? 'je Rechnung' : 'monatlich'}</span>
                <Badge variant="outline">{c.status}</Badge>
              </button>
            ))}
            {rows.length === 0 && <div className="text-muted-foreground">Noch keine Verträge erfasst.</div>}
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editId ? 'Lizenzvertrag bearbeiten' : 'Neuer Lizenzvertrag'}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Lizenznehmer</Label>
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.licensee_tenant_id} onChange={(e) => setForm({ ...form, licensee_tenant_id: e.target.value })}>
                  <option value="">– wählen –</option>
                  {licensees.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Marke</Label>
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.brand_id} onChange={(e) => setForm({ ...form, brand_id: e.target.value })}>
                  <option value="">– alle –</option>
                  {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Vertragsbeginn</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div><Label>Vertragsende</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div>
                <Label>Lizenzmodell</Label>
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.license_model} onChange={(e) => setForm({ ...form, license_model: e.target.value })}>
                  <option value="percent">Prozent vom Netto</option>
                  <option value="per_unit">pro Stück</option>
                  <option value="fixed">Fixbetrag</option>
                </select>
              </div>
              <div><Label>Royalty %</Label><Input type="number" step="0.01" value={form.royalty_percent} onChange={(e) => setForm({ ...form, royalty_percent: e.target.value })} /></div>
              <div><Label>Mindestlizenz</Label><Input type="number" step="0.01" value={form.minimum_royalty} onChange={(e) => setForm({ ...form, minimum_royalty: e.target.value })} /></div>
              <div><Label>Zahlungsziel (Tage)</Label><Input type="number" value={form.payment_terms_days} onChange={(e) => setForm({ ...form, payment_terms_days: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Abrechnung</Label>
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.billing_mode} onChange={(e) => setForm({ ...form, billing_mode: e.target.value })}>
                  <option value="monthly">Monatliche Sammelrechnung</option>
                  <option value="single">Einzelrechnung je Verkauf</option>
                </select>
              </div>
              <div className="flex items-end gap-3 pb-1">
                <Switch checked={!!form.auto_renew} onCheckedChange={(v) => setForm({ ...form, auto_renew: v })} />
                <span className="text-sm">Automatische Verlängerung</span>
              </div>
            </div>
            <div><Label>Dokument (URL)</Label><Input value={form.document_url || ''} onChange={(e) => setForm({ ...form, document_url: e.target.value })} /></div>
            <div><Label>Notizen</Label><Textarea value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={save}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
