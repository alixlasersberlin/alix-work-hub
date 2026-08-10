import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Layers, Plus, Trash2, Loader2, Crosshair } from 'lucide-react';
import { DRAWING_VIEWS, DRAWING_STATUS, plmLabel } from '@/lib/plm/config';
import { PlmFileInput } from '@/components/plm/PlmFileInput';
import { resolvePlmUrl } from '@/lib/plm/media';
import { useAuth } from '@/hooks/useAuth';

const WRITE_ROLES = ['Super Admin', 'Admin', 'Geschäftsführung', 'Medical', 'Produktion', 'QM'];

export default function PlmExplosionszeichnungen() {
  const { roles } = useAuth();
  const canWrite = (roles || []).some((r: string) => WRITE_ROLES.includes(r));

  const [drawings, setDrawings] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [parts, setParts] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [dlgOpen, setDlgOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const [posForm, setPosForm] = useState<any>({ part_id: '', label: '', quantity: 1 });

  async function loadAll() {
    setLoading(true);
    const [d, dev, p] = await Promise.all([
      (supabase.from('plm_drawings' as any) as any).select('*').order('created_at', { ascending: false }),
      (supabase.from('plm_devices' as any) as any).select('id,name,article_number').order('name'),
      (supabase.from('plm_parts' as any) as any).select('id,name,part_number').order('part_number').limit(1000),
    ]);
    setDrawings((d.data as any[]) || []);
    setDevices((dev.data as any[]) || []);
    setParts((p.data as any[]) || []);
    setLoading(false);
  }
  useEffect(() => { loadAll(); }, []);

  async function loadPositions(drawingId: string) {
    const { data } = await (supabase.from('plm_drawing_positions' as any) as any)
      .select('*').eq('drawing_id', drawingId).order('position_no');
    setPositions((data as any[]) || []);
  }

  useEffect(() => { if (selected) loadPositions(selected.id); else setPositions([]); }, [selected?.id]);

  const partText = (id: string | null) => {
    const p = parts.find(x => x.id === id);
    return p ? `${p.part_number ?? ''} · ${p.name}` : '—';
  };

  const nextPos = useMemo(
    () => (positions.length ? Math.max(...positions.map(p => p.position_no || 0)) + 1 : 1),
    [positions],
  );

  async function saveDrawing() {
    const payload = { ...form, device_id: form.device_id || null, assembly_id: null };
    const { error } = await (supabase.from('plm_drawings' as any) as any).insert(payload);
    if (error) return toast.error(error.message);
    toast.success('Zeichnung angelegt');
    setDlgOpen(false); setForm({}); loadAll();
  }

  function handleImageClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!placing || !canWrite) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPending({ x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) });
    setPosForm({ part_id: '', label: String(nextPos), quantity: 1 });
  }

  async function savePosition() {
    if (!selected || !pending) return;
    const { error } = await (supabase.from('plm_drawing_positions' as any) as any).insert({
      drawing_id: selected.id,
      part_id: posForm.part_id || null,
      position_no: nextPos,
      label: posForm.label || String(nextPos),
      quantity: Number(posForm.quantity) || 1,
      x: pending.x, y: pending.y,
    });
    if (error) return toast.error(error.message);
    setPending(null); setPlacing(false);
    loadPositions(selected.id);
    toast.success('Position gesetzt');
  }

  async function removePosition(id: string) {
    const { error } = await (supabase.from('plm_drawing_positions' as any) as any).delete().eq('id', id);
    if (error) return toast.error(error.message);
    if (selected) loadPositions(selected.id);
  }

  return (
    <div className="container max-w-[1600px] py-6 space-y-6">
      <PageHeader
        icon={Layers}
        title="Explosionszeichnungen"
        subtitle="Zeichnungen mit klickbaren Positionsnummern und Verknüpfung zu Einzelteilen."
        noBreadcrumbs
        actions={canWrite ? <Button onClick={() => { setForm({ status: 'entwurf', view_type: 'gesamt' }); setDlgOpen(true); }}><Plus className="w-4 h-4 mr-1" /> Neue Zeichnung</Button> : null}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        <Card className="h-fit">
          <CardHeader><CardTitle className="text-base">Zeichnungen</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {drawings.map(d => (
              <button
                key={d.id}
                onClick={() => setSelected(d)}
                className={`w-full text-left rounded-md border p-3 text-sm transition ${selected?.id === d.id ? 'border-primary bg-muted/50' : 'border-border hover:bg-muted/30'}`}
              >
                <div className="font-medium">{d.title}</div>
                <div className="text-xs text-muted-foreground font-mono">{d.document_number || '—'}</div>
                <Badge variant="outline" className="mt-1 text-[10px]">{plmLabel(d.status)}</Badge>
              </button>
            ))}
            {!loading && !drawings.length && <p className="text-sm text-muted-foreground">Keine Zeichnungen vorhanden.</p>}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {!selected ? (
            <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Zeichnung links auswählen.</CardContent></Card>
          ) : (
            <>
              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">{selected.title}</CardTitle>
                  {canWrite && (
                    <Button size="sm" variant={placing ? 'default' : 'outline'} onClick={() => setPlacing(v => !v)}>
                      <Crosshair className="w-4 h-4 mr-1" /> {placing ? 'Klick auf Zeichnung…' : 'Position setzen'}
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  <div
                    className="relative w-full rounded-md border bg-muted/20 overflow-hidden cursor-crosshair"
                    onClick={handleImageClick}
                  >
                    {selected.image_url ? (
                      <img src={selected.image_url} alt={selected.title} className="w-full object-contain max-h-[620px]" />
                    ) : (
                      <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">Kein Bild hinterlegt</div>
                    )}
                    {positions.map(p => (
                      <span
                        key={p.id}
                        title={partText(p.part_id)}
                        className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold flex items-center justify-center ring-2 ring-background"
                        style={{ left: `${p.x}%`, top: `${p.y}%` }}
                      >
                        {p.label || p.position_no}
                      </span>
                    ))}
                    {pending && (
                      <span
                        className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-amber-500 text-black text-[11px] font-semibold flex items-center justify-center ring-2 ring-background animate-pulse"
                        style={{ left: `${pending.x}%`, top: `${pending.y}%` }}
                      >
                        ?
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>

              {pending && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Position {nextPos} zuordnen</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div className="md:col-span-2 space-y-1">
                      <Label className="text-xs">Einzelteil</Label>
                      <select
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                        value={posForm.part_id}
                        onChange={e => setPosForm((s: any) => ({ ...s, part_id: e.target.value }))}
                      >
                        <option value="">— keins —</option>
                        {parts.map(p => <option key={p.id} value={p.id}>{p.part_number} · {p.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Beschriftung</Label>
                      <Input value={posForm.label} onChange={e => setPosForm((s: any) => ({ ...s, label: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Menge</Label>
                      <Input type="number" value={posForm.quantity} onChange={e => setPosForm((s: any) => ({ ...s, quantity: e.target.value }))} />
                    </div>
                    <div className="md:col-span-4 flex gap-2">
                      <Button size="sm" onClick={savePosition}>Speichern</Button>
                      <Button size="sm" variant="outline" onClick={() => setPending(null)}>Abbrechen</Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader><CardTitle className="text-base">Positionsliste</CardTitle></CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Pos.</TableHead>
                        <TableHead>Einzelteil</TableHead>
                        <TableHead className="w-24">Menge</TableHead>
                        <TableHead className="w-32">Koordinaten</TableHead>
                        <TableHead className="w-16" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {positions.map(p => (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono text-xs">{p.label || p.position_no}</TableCell>
                          <TableCell className="text-sm">{partText(p.part_id)}</TableCell>
                          <TableCell className="text-sm">{p.quantity ?? 1}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{p.x}% / {p.y}%</TableCell>
                          <TableCell className="text-right">
                            {canWrite && (
                              <Button size="icon" variant="ghost" onClick={() => removePosition(p.id)}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {!positions.length && (
                        <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">Noch keine Positionen gesetzt</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Neue Zeichnung</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Dokumentnummer</Label>
              <Input value={form.document_number ?? ''} onChange={e => setForm((s: any) => ({ ...s, document_number: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Titel</Label>
              <Input value={form.title ?? ''} onChange={e => setForm((s: any) => ({ ...s, title: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Gerät</Label>
              <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={form.device_id ?? ''} onChange={e => setForm((s: any) => ({ ...s, device_id: e.target.value }))}>
                <option value="">— keins —</option>
                {devices.map(d => <option key={d.id} value={d.id}>{d.article_number} · {d.name}</option>)}
              </select></div>
            <div className="space-y-1"><Label className="text-xs">Ansicht</Label>
              <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={form.view_type ?? 'gesamt'} onChange={e => setForm((s: any) => ({ ...s, view_type: e.target.value }))}>
                {DRAWING_VIEWS.map(v => <option key={v} value={v}>{plmLabel(v)}</option>)}
              </select></div>
            <div className="space-y-1"><Label className="text-xs">Status</Label>
              <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={form.status ?? 'entwurf'} onChange={e => setForm((s: any) => ({ ...s, status: e.target.value }))}>
                {DRAWING_STATUS.map(v => <option key={v} value={v}>{plmLabel(v)}</option>)}
              </select></div>
            <div className="space-y-1"><Label className="text-xs">Version</Label>
              <Input value={form.version ?? ''} onChange={e => setForm((s: any) => ({ ...s, version: e.target.value }))} /></div>
            <div className="md:col-span-2 space-y-1"><Label className="text-xs">Bild-URL (Explosionszeichnung)</Label>
              <Input value={form.image_url ?? ''} onChange={e => setForm((s: any) => ({ ...s, image_url: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlgOpen(false)}>Abbrechen</Button>
            <Button onClick={saveDrawing}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
