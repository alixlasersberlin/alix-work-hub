import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useMedTenant, MED_COMPLIANCE_KINDS } from '@/hooks/useMedTenant';
import { toast } from 'sonner';
import { Loader2, Plus } from 'lucide-react';

export default function MedCompliance() {
  const { tenantId, canWrite, loading } = useMedTenant();
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({});

  const load = async () => {
    if (!tenantId) return;
    setBusy(true);
    const { data } = await supabase.from('med_compliance_docs' as any)
      .select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
    setRows(((data as any) || []) as any[]);
    setBusy(false);
  };

  useEffect(() => { load(); }, [tenantId]);

  const save = async () => {
    if (!tenantId || !form.title || !form.doc_kind) { toast.error('Titel und Art erforderlich'); return; }
    const payload = {
      tenant_id: tenantId,
      doc_kind: form.doc_kind,
      title: form.title,
      reference: form.reference || null,
      valid_from: form.valid_from || null,
      valid_until: form.valid_until || null,
      status: form.status || 'aktiv',
      file_url: form.file_url || null,
      notes: form.notes || null,
    };
    const res = form.id
      ? await supabase.from('med_compliance_docs' as any).update(payload as any).eq('id', form.id)
      : await supabase.from('med_compliance_docs' as any).insert(payload as any);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success('Dokument gespeichert');
    setOpen(false); setForm({}); load();
  };

  const expiring = (d: any) => d.valid_until && new Date(d.valid_until) < new Date(Date.now() + 60 * 86400000);

  if (loading) return <div className="p-6"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="p-4 lg:p-6 space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">⚕️ Alix Medical</div>
          <h1 className="text-2xl font-display font-bold">MDR / CE / ISO 13485</h1>
        </div>
        {canWrite && <Button onClick={() => { setForm({ doc_kind: 'mdr', status: 'aktiv' }); setOpen(true); }}><Plus className="w-4 h-4 mr-1" /> Neues Dokument</Button>}
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left p-3">Titel</th>
              <th className="text-left p-3">Art</th>
              <th className="text-left p-3">Referenz</th>
              <th className="text-left p-3">Gültig bis</th>
              <th className="text-left p-3">Status</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {busy && <tr><td colSpan={6} className="p-6 text-center"><Loader2 className="w-4 h-4 animate-spin inline" /></td></tr>}
            {!busy && rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Keine Dokumente</td></tr>}
            {rows.map(r => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-3">
                  {r.file_url ? <a href={r.file_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{r.title}</a> : r.title}
                </td>
                <td className="p-3">{MED_COMPLIANCE_KINDS.find(k => k.value === r.doc_kind)?.label || r.doc_kind}</td>
                <td className="p-3 text-muted-foreground">{r.reference || '–'}</td>
                <td className="p-3">{r.valid_until || '–'}</td>
                <td className="p-3">
                  <Badge variant={expiring(r) ? 'destructive' : 'outline'}>{expiring(r) ? 'läuft ab' : r.status}</Badge>
                </td>
                <td className="p-3 text-right">
                  {canWrite && <Button size="sm" variant="ghost" onClick={() => { setForm(r); setOpen(true); }}>Bearbeiten</Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{form.id ? 'Dokument bearbeiten' : 'Neues Dokument'}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label>Titel</Label><Input value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div>
              <Label>Art</Label>
              <select className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
                value={form.doc_kind || ''} onChange={e => setForm({ ...form, doc_kind: e.target.value })}>
                {MED_COMPLIANCE_KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
            </div>
            <div><Label>Referenz</Label><Input value={form.reference || ''} onChange={e => setForm({ ...form, reference: e.target.value })} /></div>
            <div><Label>Gültig ab</Label><Input type="date" value={form.valid_from || ''} onChange={e => setForm({ ...form, valid_from: e.target.value })} /></div>
            <div><Label>Gültig bis</Label><Input type="date" value={form.valid_until || ''} onChange={e => setForm({ ...form, valid_until: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Datei-Link</Label><Input value={form.file_url || ''} onChange={e => setForm({ ...form, file_url: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Notizen</Label><Textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
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
