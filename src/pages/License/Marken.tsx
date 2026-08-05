import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Crown, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLicense } from '@/hooks/useLicense';

const EMPTY = { name: '', code: '', registration_number: '', jurisdiction: '', valid_from: '', valid_to: '', status: 'aktiv', notes: '' };

export default function LicenseMarken() {
  const { licensor, canWrite } = useLicense();
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(EMPTY);

  const load = async () => {
    setBusy(true);
    const { data } = await supabase.from('brand_registry' as any).select('*').order('name');
    setRows(((data as any[]) || []));
    setBusy(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name.trim()) { toast.error('Bitte einen Markennamen angeben.'); return; }
    const payload: any = {
      ...form,
      valid_from: form.valid_from || null,
      valid_to: form.valid_to || null,
      owner_tenant_id: licensor?.id ?? null,
      tenant_id: licensor?.id ?? null,
    };
    const { error } = editId
      ? await supabase.from('brand_registry' as any).update(payload).eq('id', editId)
      : await supabase.from('brand_registry' as any).insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success('Marke gespeichert.');
    setOpen(false); setEditId(null); setForm(EMPTY); load();
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Marken"
        subtitle="Markenregister der Alix License"
        icon={Crown}
        actions={canWrite && (
          <Button onClick={() => { setEditId(null); setForm(EMPTY); setOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Neue Marke
          </Button>
        )}
      />

      <Card className="p-4">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : (
          <div className="space-y-2 text-sm">
            {rows.map((b) => (
              <button key={b.id} onClick={() => { if (!canWrite) return; setEditId(b.id); setForm({ ...EMPTY, ...b, valid_from: b.valid_from || '', valid_to: b.valid_to || '' }); setOpen(true); }}
                className="flex w-full items-center justify-between gap-4 border-b border-border/50 pb-2 text-left hover:opacity-80">
                <span className="font-medium">{b.name}</span>
                <span className="text-muted-foreground">{b.registration_number || '–'}</span>
                <span className="text-muted-foreground">{b.jurisdiction || '–'}</span>
                <Badge variant="outline">{b.status}</Badge>
              </button>
            ))}
            {rows.length === 0 && <div className="text-muted-foreground">Noch keine Marken erfasst.</div>}
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? 'Marke bearbeiten' : 'Neue Marke'}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Kürzel</Label><Input value={form.code || ''} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
              <div><Label>Registernummer</Label><Input value={form.registration_number || ''} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Rechtsraum</Label><Input value={form.jurisdiction || ''} onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })} /></div>
              <div><Label>Gültig ab</Label><Input type="date" value={form.valid_from || ''} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} /></div>
              <div><Label>Gültig bis</Label><Input type="date" value={form.valid_to || ''} onChange={(e) => setForm({ ...form, valid_to: e.target.value })} /></div>
            </div>
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
