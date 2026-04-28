import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Factory, Download, Search, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type PhotoSide = 'front' | 'right' | 'left';

interface ProductionOrderRow {
  id: string;
  order_number: string;
  status: string;
  liefertermin: string;
  modellname: string | null;
  farbe: string | null;
  bearbeiter: string | null;
  power_handstueck: string | null;
  sonderwuensche: string | null;
  anmerkungen: string | null;
  seriennummer: string | null;
  pdf_path: string | null;
  photo_front_path: string | null;
  photo_right_path: string | null;
  photo_left_path: string | null;
  supplier_id: string;
  created_at: string;
  sent_at: string | null;
  supplier?: { name: string | null } | null;
}

const STATUS_OPTIONS = [
  'offen',
  'in Bearbeitung',
  'fertig',
  'versendet',
];

export default function ProductionPortal() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<ProductionOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProductionOrderRow | null>(null);
  const [editForm, setEditForm] = useState<Partial<ProductionOrderRow>>({});
  const [saving, setSaving] = useState(false);
  const [photoPreviews, setPhotoPreviews] = useState<Record<PhotoSide, string | null>>({ front: null, right: null, left: null });
  const [uploadingSide, setUploadingSide] = useState<PhotoSide | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('production_orders')
      .select('*, supplier:suppliers(name)')
      .order('liefertermin', { ascending: true });
    if (error) toast.error(error.message);
    else setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    const { error } = await supabase
      .from('production_orders')
      .update({ status: newStatus })
      .eq('id', id);
    setUpdatingId(null);
    if (error) return toast.error(error.message);
    toast.success('Status aktualisiert');
    setRows(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
  };

  const signedPhotoUrl = async (path: string | null) => {
    if (!path) return null;
    const { data } = await supabase.storage.from('production-photos').createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  };

  const openEdit = async (row: ProductionOrderRow) => {
    setEditing(row);
    setEditForm({
      modellname: row.modellname,
      farbe: row.farbe,
      power_handstueck: row.power_handstueck,
      bearbeiter: row.bearbeiter,
      seriennummer: row.seriennummer,
      sonderwuensche: row.sonderwuensche,
      anmerkungen: row.anmerkungen,
      status: row.status,
      photo_front_path: row.photo_front_path,
      photo_right_path: row.photo_right_path,
      photo_left_path: row.photo_left_path,
    });
    setPhotoPreviews({ front: null, right: null, left: null });
    const [front, right, left] = await Promise.all([
      signedPhotoUrl(row.photo_front_path),
      signedPhotoUrl(row.photo_right_path),
      signedPhotoUrl(row.photo_left_path),
    ]);
    setPhotoPreviews({ front, right, left });
  };

  const handlePhotoUpload = async (side: PhotoSide, file: File) => {
    if (!editing) return;
    setUploadingSide(side);
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${editing.supplier_id}/${editing.id}/${side}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from('production-photos')
      .upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' });
    if (error) {
      setUploadingSide(null);
      return toast.error(error.message);
    }
    const key = `photo_${side}_path` as 'photo_front_path' | 'photo_right_path' | 'photo_left_path';
    setEditForm(f => ({ ...f, [key]: path }));
    const url = await signedPhotoUrl(path);
    setPhotoPreviews(p => ({ ...p, [side]: url }));
    setUploadingSide(null);
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editForm.photo_front_path || !editForm.photo_right_path || !editForm.photo_left_path) {
      return toast.error('Bitte alle 3 Fotos (Vorne, Rechts, Links) hochladen.');
    }
    setSaving(true);
    const payload = {
      modellname: editForm.modellname ?? null,
      farbe: editForm.farbe ?? '',
      power_handstueck: editForm.power_handstueck ?? '',
      bearbeiter: editForm.bearbeiter ?? '',
      seriennummer: editForm.seriennummer ?? null,
      sonderwuensche: editForm.sonderwuensche ?? null,
      anmerkungen: editForm.anmerkungen ?? null,
      status: editForm.status ?? editing.status,
      photo_front_path: editForm.photo_front_path,
      photo_right_path: editForm.photo_right_path,
      photo_left_path: editForm.photo_left_path,
    };
    const { error } = await supabase
      .from('production_orders')
      .update(payload)
      .eq('id', editing.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Auftrag gespeichert');
    setRows(prev => prev.map(r => r.id === editing.id ? { ...r, ...payload } as ProductionOrderRow : r));
    setEditing(null);
  };

  const downloadPdf = async (path: string | null, orderNumber: string) => {
    if (!path) return toast.error('Kein PDF verfügbar');
    const { data, error } = await supabase.storage.from('production-orders').download(path);
    if (error || !data) return toast.error(error?.message || 'Download fehlgeschlagen');
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${orderNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const q = search.trim().toLowerCase();
  const filtered = rows.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (!q) return true;
    const hay = `${r.order_number} ${r.modellname || ''} ${r.farbe || ''} ${r.bearbeiter || ''} ${r.seriennummer || ''}`.toLowerCase();
    return hay.includes(q);
  });

  const supplierName = rows[0]?.supplier?.name;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold gold-text flex items-center gap-2">
            <Factory className="w-6 h-6" /> PRODUCTION
          </h1>
          <p className="text-sm text-muted-foreground">
            Arbeitsliste {supplierName ? `– ${supplierName}` : ''}
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          Angemeldet als <span className="text-foreground font-medium">{profile?.full_name || profile?.email}</span>
        </div>
      </div>

      <Card className="p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suche: Auftragsnr., Modell, Farbe, Seriennr., Bearbeiter…"
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            {STATUS_OPTIONS.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={load} disabled={loading}>
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Aktualisieren
        </Button>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Factory className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Keine Bestellungen gefunden.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(row => (
            <Card key={row.id} className="p-5 space-y-3 card-glow">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display font-semibold text-foreground">{row.order_number}</p>
                  <p className="text-xs text-muted-foreground">
                    Liefertermin: <span className="text-foreground font-medium">
                      {row.liefertermin ? format(new Date(row.liefertermin), 'dd.MM.yyyy') : '—'}
                    </span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                    <Pencil className="w-4 h-4 mr-1" /> Bearbeiten
                  </Button>
                  {row.pdf_path && (
                    <Button size="sm" variant="outline" onClick={() => downloadPdf(row.pdf_path, row.order_number)}>
                      <Download className="w-4 h-4 mr-1" /> PDF
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Modell:</span>{' '}
                  <span className="text-foreground">{row.modellname || '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Farbe:</span>{' '}
                  <span className="text-foreground">{row.farbe || '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Power-Handstück:</span>{' '}
                  <span className="text-foreground">{row.power_handstueck || '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Bearbeiter:</span>{' '}
                  <span className="text-foreground">{row.bearbeiter || '—'}</span>
                </div>
                {row.seriennummer && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Seriennummer:</span>{' '}
                    <span className="text-foreground">{row.seriennummer}</span>
                  </div>
                )}
                {row.sonderwuensche && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Sonderwünsche:</span>{' '}
                    <span className="text-foreground">{row.sonderwuensche}</span>
                  </div>
                )}
                {row.anmerkungen && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Anmerkungen:</span>{' '}
                    <span className="text-foreground">{row.anmerkungen}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <span className="text-xs text-muted-foreground">Status:</span>
                <Select
                  value={row.status}
                  onValueChange={(v) => updateStatus(row.id, v)}
                  disabled={updatingId === row.id}
                >
                  <SelectTrigger className="h-8 w-[180px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {updatingId === row.id && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Auftrag bearbeiten {editing && `– ${editing.order_number}`}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Modell</Label>
              <Input value={editForm.modellname ?? ''} onChange={e => setEditForm(f => ({ ...f, modellname: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Farbe</Label>
              <Input value={editForm.farbe ?? ''} onChange={e => setEditForm(f => ({ ...f, farbe: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Power-Handstück</Label>
              <Input value={editForm.power_handstueck ?? ''} onChange={e => setEditForm(f => ({ ...f, power_handstueck: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Bearbeiter</Label>
              <Input value={editForm.bearbeiter ?? ''} onChange={e => setEditForm(f => ({ ...f, bearbeiter: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Seriennummer</Label>
              <Input value={editForm.seriennummer ?? ''} onChange={e => setEditForm(f => ({ ...f, seriennummer: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={editForm.status ?? 'offen'} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Fotos <span className="text-destructive">*</span> <span className="text-xs text-muted-foreground font-normal">(alle 3 erforderlich)</span></Label>
              <div className="grid grid-cols-3 gap-3">
                {(['front','right','left'] as PhotoSide[]).map(side => {
                  const labels: Record<PhotoSide,string> = { front: 'Vorne', right: 'Rechts', left: 'Links' };
                  const key = `photo_${side}_path` as 'photo_front_path' | 'photo_right_path' | 'photo_left_path';
                  const hasPhoto = !!editForm[key];
                  const preview = photoPreviews[side];
                  const inputId = `photo-${side}`;
                  return (
                    <div key={side} className="space-y-1.5">
                      <div className="text-xs font-medium text-muted-foreground text-center">{labels[side]}</div>
                      <label
                        htmlFor={inputId}
                        className={cn(
                          "relative aspect-square w-full rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer overflow-hidden bg-muted/20 hover:bg-muted/40 transition-colors",
                          hasPhoto ? "border-primary/40" : "border-border"
                        )}
                      >
                        {preview ? (
                          <img src={preview} alt={labels[side]} className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center text-muted-foreground text-[11px] gap-1 p-2 text-center">
                            <Camera className="w-5 h-5" />
                            <span>Foto wählen<br/>oder Kamera</span>
                          </div>
                        )}
                        {uploadingSide === side && (
                          <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
                          </div>
                        )}
                      </label>
                      <input
                        id={inputId}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handlePhotoUpload(side, file);
                          e.target.value = '';
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Sonderwünsche</Label>
              <Textarea rows={2} value={editForm.sonderwuensche ?? ''} onChange={e => setEditForm(f => ({ ...f, sonderwuensche: e.target.value }))} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Anmerkungen</Label>
              <Textarea rows={3} value={editForm.anmerkungen ?? ''} onChange={e => setEditForm(f => ({ ...f, anmerkungen: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Abbrechen</Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
