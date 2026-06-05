import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { sbRepair } from '@/lib/repair/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Upload, FileText } from 'lucide-react';
import { generateHandoverPdf, type HandoverDoc } from '@/lib/repair/handover-pdf';

const F = ({ label, children, className = '' }: any) => (
  <div className={className}><Label className="text-xs">{label}</Label><div className="mt-1">{children}</div></div>
);

/* ------------------------------------------------------------------ */
/* 1) Werkstatt-Annahme (1:1 zu repair_orders)                        */
/* ------------------------------------------------------------------ */
export function WerkstattAnnahmeTab({ repairId, canEdit }: { repairId: string; canEdit: boolean }) {
  const { toast } = useToast();
  const [row, setRow] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await sbRepair.from('repair_workshop_intake').select('*').eq('repair_order_id', repairId).maybeSingle();
    setRow(data || { repair_order_id: repairId, condition_notes: '', accessories_received: '' });
    const { data: ph } = await supabase.storage.from('repair-files').list(`${repairId}/intake-photos`, { limit: 200 });
    setPhotos(ph || []);
    setLoading(false);
  }, [repairId]);

  useEffect(() => { reload(); }, [reload]);

  const upd = (k: string, v: any) => setRow({ ...row, [k]: v });

  const save = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      repair_order_id: repairId,
      condition_notes: row.condition_notes || null,
      accessories_received: row.accessories_received || null,
      received_by: user?.id,
    };
    const { error } = row.id
      ? await sbRepair.from('repair_workshop_intake').update(payload).eq('id', row.id)
      : await sbRepair.from('repair_workshop_intake').insert(payload);
    setSaving(false);
    if (error) toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Werkstattannahme gespeichert' }); reload(); }
  };

  const uploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const path = `${repairId}/intake-photos/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('repair-files').upload(path, file);
    setUploading(false); e.target.value = '';
    if (error) toast({ title: 'Upload fehlgeschlagen', description: error.message, variant: 'destructive' });
    else reload();
  };

  const viewPhoto = async (name: string) => {
    const { data } = await supabase.storage.from('repair-files').createSignedUrl(`${repairId}/intake-photos/${name}`, 600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  if (loading || !row) return <Card className="p-6 text-center text-muted-foreground text-sm">Lade…</Card>;

  return (
    <Card className="p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <F label="Zustand des Geräts bei Annahme" className="md:col-span-2">
          <Textarea rows={3} value={row.condition_notes || ''} onChange={(e) => upd('condition_notes', e.target.value)} disabled={!canEdit} />
        </F>
        <F label="Tatsächlich erhaltenes Zubehör" className="md:col-span-2">
          <Textarea rows={2} value={row.accessories_received || ''} onChange={(e) => upd('accessories_received', e.target.value)} disabled={!canEdit} />
        </F>
        {row.received_at && <F label="Eingangsdatum"><Input value={new Date(row.received_at).toLocaleString('de-DE')} disabled /></F>}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold">Fotos der Annahme</h4>
          {canEdit && (
            <label className="cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={uploadPhoto} disabled={uploading} />
              <span className="inline-flex items-center px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs">
                <Upload className="w-3 h-3 mr-1" /> {uploading ? 'Lädt…' : 'Foto hinzufügen'}
              </span>
            </label>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {photos.length === 0 && <p className="text-xs text-muted-foreground col-span-full">Noch keine Fotos</p>}
          {photos.map((p) => (
            <button key={p.name} onClick={() => viewPhoto(p.name)} className="text-xs p-2 border border-border rounded hover:bg-muted/40 text-left">
              <FileText className="w-4 h-4 inline mr-1" /> {p.name.split('-').slice(1).join('-')}
            </button>
          ))}
        </div>
      </div>

      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>{saving ? 'Speichere…' : 'Werkstattannahme speichern'}</Button>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* 2) Werkstattaufträge (n)                                           */
/* ------------------------------------------------------------------ */
export function WerkstattauftraegeTab({ repairId, canEdit }: { repairId: string; canEdit: boolean }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);
  const [n, setN] = useState<any>({ diagnosis: '', work_performed: '', labor_hours: '', labor_rate: '', status: 'offen' });

  const load = useCallback(async () => {
    const { data } = await sbRepair.from('repair_work_orders').select('*').eq('repair_order_id', repairId).order('created_at', { ascending: false });
    setRows(data || []);
  }, [repairId]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    const { error } = await sbRepair.from('repair_work_orders').insert({
      repair_order_id: repairId,
      diagnosis: n.diagnosis || null, work_performed: n.work_performed || null,
      labor_hours: n.labor_hours ? Number(n.labor_hours) : null,
      labor_rate: n.labor_rate ? Number(n.labor_rate) : null,
      status: n.status,
    });
    if (error) return toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    setN({ diagnosis: '', work_performed: '', labor_hours: '', labor_rate: '', status: 'offen' });
    setAdding(false); load();
  };

  const setStatus = async (id: string, status: string) => {
    const patch: any = { status };
    if (status === 'in_arbeit' && !rows.find(r => r.id === id)?.started_at) patch.started_at = new Date().toISOString();
    if (status === 'erledigt') patch.finished_at = new Date().toISOString();
    await sbRepair.from('repair_work_orders').update(patch).eq('id', id); load();
  };

  const del = async (id: string) => { await sbRepair.from('repair_work_orders').delete().eq('id', id); load(); };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Werkstattaufträge</h3>
        {canEdit && <Button size="sm" onClick={() => setAdding((s) => !s)}><Plus className="w-4 h-4 mr-1" /> Neuer Auftrag</Button>}
      </div>
      {adding && (
        <Card className="p-3 bg-muted/30 space-y-2">
          <Textarea placeholder="Diagnose" rows={2} value={n.diagnosis} onChange={(e) => setN({ ...n, diagnosis: e.target.value })} />
          <Textarea placeholder="Durchgeführte Arbeiten" rows={2} value={n.work_performed} onChange={(e) => setN({ ...n, work_performed: e.target.value })} />
          <div className="grid grid-cols-3 gap-2">
            <Input type="number" step="0.25" placeholder="Stunden" value={n.labor_hours} onChange={(e) => setN({ ...n, labor_hours: e.target.value })} />
            <Input type="number" step="0.01" placeholder="Stundensatz €" value={n.labor_rate} onChange={(e) => setN({ ...n, labor_rate: e.target.value })} />
            <Select value={n.status} onValueChange={(v) => setN({ ...n, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{['offen','in_arbeit','erledigt','abgebrochen'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setAdding(false)}>Abbrechen</Button>
            <Button size="sm" onClick={add}>Speichern</Button>
          </div>
        </Card>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground uppercase">
            <tr><th className="text-left py-2">Diagnose / Arbeit</th><th className="text-left">Std.</th><th className="text-left">Satz</th><th className="text-left">Summe</th><th className="text-left">Status</th><th></th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="text-center py-4 text-muted-foreground text-xs">Keine Aufträge</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border align-top">
                <td className="py-2 text-xs">
                  {r.diagnosis && <div><b>Dx:</b> {r.diagnosis}</div>}
                  {r.work_performed && <div><b>Arbeit:</b> {r.work_performed}</div>}
                  {r.started_at && <div className="text-muted-foreground">Start: {new Date(r.started_at).toLocaleString('de-DE')}</div>}
                  {r.finished_at && <div className="text-muted-foreground">Ende: {new Date(r.finished_at).toLocaleString('de-DE')}</div>}
                </td>
                <td className="text-xs">{r.labor_hours ?? '–'}</td>
                <td className="text-xs">{r.labor_rate ? `${r.labor_rate} €` : '–'}</td>
                <td className="text-xs">{r.labor_hours && r.labor_rate ? `${(Number(r.labor_hours) * Number(r.labor_rate)).toFixed(2)} €` : '–'}</td>
                <td>
                  {canEdit ? (
                    <Select value={r.status} onValueChange={(v) => setStatus(r.id, v)}>
                      <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>{['offen','in_arbeit','erledigt','abgebrochen'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : <span className="text-xs">{r.status}</span>}
                </td>
                <td className="text-right">{canEdit && <Button size="sm" variant="ghost" onClick={() => del(r.id)}><Trash2 className="w-3 h-3" /></Button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* 3) Spare Parts (erweitert)                                         */
/* ------------------------------------------------------------------ */
export function SparePartsTab({ repairId, canEdit }: { repairId: string; canEdit: boolean }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);
  const [n, setN] = useState<any>({ part_name: '', part_number: '', supplier: '', quantity: 1, unit_price: '', currency: 'EUR', status: 'bestellt', notes: '' });

  const load = useCallback(async () => {
    const { data } = await sbRepair.from('repair_spare_parts').select('*').eq('repair_order_id', repairId).order('created_at', { ascending: false });
    setRows(data || []);
  }, [repairId]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!n.part_name) return toast({ title: 'Bezeichnung fehlt', variant: 'destructive' });
    const { error } = await sbRepair.from('repair_spare_parts').insert({
      repair_order_id: repairId,
      part_name: n.part_name, part_number: n.part_number || null, supplier: n.supplier || null,
      quantity: Number(n.quantity) || 1,
      unit_price: n.unit_price ? Number(n.unit_price) : null,
      currency: n.currency, status: n.status, notes: n.notes || null,
      ordered_at: n.status === 'bestellt' ? new Date().toISOString() : null,
    });
    if (error) return toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    setN({ part_name: '', part_number: '', supplier: '', quantity: 1, unit_price: '', currency: 'EUR', status: 'bestellt', notes: '' });
    setAdding(false); load();
  };

  const setStatus = async (id: string, status: string) => {
    const patch: any = { status };
    if (status === 'erhalten') patch.received_at = new Date().toISOString();
    if (status === 'bestellt' && !rows.find(r => r.id === id)?.ordered_at) patch.ordered_at = new Date().toISOString();
    await sbRepair.from('repair_spare_parts').update(patch).eq('id', id); load();
  };

  const del = async (id: string) => { await sbRepair.from('repair_spare_parts').delete().eq('id', id); load(); };

  const total = rows.reduce((sum, r) => sum + (Number(r.unit_price || 0) * Number(r.quantity || 0)), 0);

  return (
    <Card className="p-4 space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Ersatzteil-Bestellungen</h3>
        {canEdit && <Button size="sm" onClick={() => setAdding((s) => !s)}><Plus className="w-4 h-4 mr-1" /> Hinzufügen</Button>}
      </div>
      {adding && (
        <Card className="p-3 bg-muted/30">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <Input placeholder="Bezeichnung *" value={n.part_name} onChange={(e) => setN({ ...n, part_name: e.target.value })} />
            <Input placeholder="Teilenummer" value={n.part_number} onChange={(e) => setN({ ...n, part_number: e.target.value })} />
            <Input placeholder="Lieferant" value={n.supplier} onChange={(e) => setN({ ...n, supplier: e.target.value })} />
            <Input type="number" placeholder="Menge" value={n.quantity} onChange={(e) => setN({ ...n, quantity: e.target.value })} />
            <Input type="number" step="0.01" placeholder="Einzelpreis" value={n.unit_price} onChange={(e) => setN({ ...n, unit_price: e.target.value })} />
            <Select value={n.currency} onValueChange={(v) => setN({ ...n, currency: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{['EUR','USD','CHF'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={n.status} onValueChange={(v) => setN({ ...n, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{['anfrage','bestellt','erhalten','storniert'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Notiz" value={n.notes} onChange={(e) => setN({ ...n, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={() => setAdding(false)}>Abbrechen</Button>
            <Button size="sm" onClick={add}>Speichern</Button>
          </div>
        </Card>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground uppercase">
            <tr><th className="text-left py-2">Teil</th><th className="text-left">Nr.</th><th className="text-left">Lieferant</th><th className="text-left">Menge</th><th className="text-left">Preis</th><th className="text-left">Status</th><th className="text-left">Erhalten</th><th></th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="text-center py-4 text-muted-foreground text-xs">Keine Bestellungen</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="py-2">{r.part_name}{r.notes && <div className="text-xs text-muted-foreground">{r.notes}</div>}</td>
                <td className="text-xs font-mono">{r.part_number || '–'}</td>
                <td className="text-xs">{r.supplier || '–'}</td>
                <td className="text-xs">{r.quantity}</td>
                <td className="text-xs">{r.unit_price ? `${r.unit_price} ${r.currency}` : '–'}</td>
                <td>
                  {canEdit ? (
                    <Select value={r.status} onValueChange={(v) => setStatus(r.id, v)}>
                      <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>{['anfrage','bestellt','erhalten','storniert'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : <span className="text-xs">{r.status}</span>}
                </td>
                <td className="text-xs">{r.received_at ? new Date(r.received_at).toLocaleDateString('de-DE') : '–'}</td>
                <td className="text-right">{canEdit && <Button size="sm" variant="ghost" onClick={() => del(r.id)}><Trash2 className="w-3 h-3" /></Button>}</td>
              </tr>
            ))}
            {rows.length > 0 && (
              <tr className="border-t border-border font-semibold"><td colSpan={4} className="py-2 text-right text-xs">Summe:</td><td className="text-xs">{total.toFixed(2)} €</td><td colSpan={3}></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Audit helper                                                       */
/* ------------------------------------------------------------------ */
async function logRepairAudit(action: string, repairId: string, details: any) {
  try {
    await supabase.rpc('log_audit_event', {
      _action: action,
      _module: 'repair',
      _record_id: repairId,
      _details: details,
      _ip_address: null,
      _user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    });
  } catch (e) {
    console.warn('audit log failed', e);
  }
}

const SIG_MIME = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
const SIG_MAX_BYTES = 5 * 1024 * 1024;

function validateSignatureFile(file: File): string | null {
  if (!SIG_MIME.includes(file.type)) return 'Nur PNG, JPG, WEBP oder PDF erlaubt';
  if (file.size > SIG_MAX_BYTES) return 'Datei zu groß (max. 5 MB)';
  if (file.size < 200) return 'Signatur scheint leer zu sein';
  return null;
}

/* ------------------------------------------------------------------ */
/* Belege-Checkliste (Pflicht-Uploads vor Statuswechsel)              */
/* ------------------------------------------------------------------ */
type ChecklistItem = { key: string; label: string; required: boolean; category: string };
type UploadedDoc = { key: string; path: string; name: string; size: number; mime: string };

const DOC_MIME = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
const DOC_MAX_BYTES = 10 * 1024 * 1024;

function validateDocFile(file: File): string | null {
  if (!DOC_MIME.includes(file.type)) return 'Nur PNG, JPG, WEBP oder PDF erlaubt';
  if (file.size > DOC_MAX_BYTES) return 'Datei zu groß (max. 10 MB)';
  if (file.size < 200) return 'Datei scheint leer zu sein';
  return null;
}

function DocChecklist({
  items, repairId, folder, docs, setDocs, disabled,
}: {
  items: ChecklistItem[]; repairId: string; folder: string;
  docs: UploadedDoc[]; setDocs: (d: UploadedDoc[]) => void; disabled?: boolean;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const upload = async (item: ChecklistItem, file: File) => {
    const err = validateDocFile(file);
    if (err) return toast({ title: 'Validierung', description: `${item.label}: ${err}`, variant: 'destructive' });
    setBusy(item.key);
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${repairId}/${folder}/${Date.now()}-${item.key}-${safe}`;
    const { error } = await supabase.storage.from('repair-files').upload(path, file, { contentType: file.type });
    setBusy(null);
    if (error) return toast({ title: 'Upload fehlgeschlagen', description: error.message, variant: 'destructive' });
    const next = docs.filter((d) => d.key !== item.key);
    next.push({ key: item.key, path, name: file.name, size: file.size, mime: file.type });
    setDocs(next);
  };

  const remove = async (item: ChecklistItem) => {
    const d = docs.find((x) => x.key === item.key);
    if (!d) return;
    await supabase.storage.from('repair-files').remove([d.path]);
    setDocs(docs.filter((x) => x.key !== item.key));
  };

  return (
    <div className="space-y-2 rounded-md border border-border p-3 bg-background/50">
      <div className="text-xs font-semibold uppercase text-muted-foreground">Belege-Checkliste</div>
      {items.map((it) => {
        const got = docs.find((d) => d.key === it.key);
        return (
          <div key={it.key} className="flex items-center gap-2 text-xs flex-wrap">
            <span className={`inline-block w-4 ${got ? 'text-emerald-400' : it.required ? 'text-destructive' : 'text-muted-foreground'}`}>
              {got ? '✓' : it.required ? '●' : '○'}
            </span>
            <span className="min-w-[180px]">
              {it.label} {it.required && <span className="text-destructive">*</span>}
            </span>
            {got ? (
              <>
                <span className="text-emerald-400 truncate max-w-[220px]">{got.name} ({Math.round(got.size / 1024)} KB)</span>
                {!disabled && <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => remove(it)}><Trash2 className="w-3 h-3" /></Button>}
              </>
            ) : (
              <label className="cursor-pointer">
                <input
                  type="file" className="hidden" accept="image/png,image/jpeg,image/webp,application/pdf"
                  disabled={disabled || busy === it.key}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(it, f); e.currentTarget.value = ''; }}
                />
                <span className="inline-flex items-center px-2 py-1 rounded bg-muted hover:bg-muted/70 text-xs">
                  <Upload className="w-3 h-3 mr-1" /> {busy === it.key ? 'Lädt…' : 'Hochladen'}
                </span>
              </label>
            )}
          </div>
        );
      })}
      <p className="text-[10px] text-muted-foreground">Pflichtbelege (*) müssen vor Bestätigung hochgeladen sein. Dateien werden zusätzlich unter „Anhänge" gespeichert.</p>
    </div>
  );
}

function missingRequiredDocs(items: ChecklistItem[], docs: UploadedDoc[]): string[] {
  return items.filter((i) => i.required && !docs.find((d) => d.key === i.key)).map((i) => i.label);
}

async function persistChecklistAttachments(
  repairId: string, docs: UploadedDoc[], items: ChecklistItem[],
) {
  if (!docs.length) return;
  const { data: { user } } = await supabase.auth.getUser();
  const rows = docs.map((d) => {
    const it = items.find((i) => i.key === d.key);
    return {
      repair_order_id: repairId,
      file_path: d.path, file_name: d.name,
      mime_type: d.mime, size_bytes: d.size,
      category: it?.category || d.key,
      uploaded_by: user?.id,
    };
  });
  await sbRepair.from('repair_attachments').insert(rows);
}

const FINANCE_CHECKLIST: ChecklistItem[] = [
  { key: 'rechnung', label: 'Rechnung', required: true, category: 'rechnung' },
  { key: 'lieferschein', label: 'Lieferschein', required: true, category: 'lieferschein' },
  { key: 'zahlungsnachweis', label: 'Zahlungsnachweis', required: false, category: 'zahlungsnachweis' },
];

const DELIVERY_CHECKLIST: ChecklistItem[] = [
  { key: 'lieferschein', label: 'Lieferschein', required: true, category: 'lieferschein' },
  { key: 'uebergabeprotokoll', label: 'Übergabeprotokoll', required: true, category: 'uebergabeprotokoll' },
  { key: 'foto', label: 'Foto Gerätezustand', required: false, category: 'foto' },
];

/* ------------------------------------------------------------------ */
/* Handover-PDF Preview + Re-Download                                 */
/* ------------------------------------------------------------------ */
function useHandoverPdfs(repairId: string, category: string, reloadKey: number) {
  const [list, setList] = useState<any[]>([]);
  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await sbRepair
        .from('repair_attachments').select('*')
        .eq('repair_order_id', repairId).eq('category', category)
        .order('created_at', { ascending: false });
      if (!cancel) setList(data || []);
    })();
    return () => { cancel = true; };
  }, [repairId, category, reloadKey]);
  return list;
}

function matchPdfForHandover(pdfs: any[], handoverAt: string | null) {
  if (!pdfs.length || !handoverAt) return null;
  const t = new Date(handoverAt).getTime();
  let best: any = null; let bestDiff = Infinity;
  for (const p of pdfs) {
    const diff = Math.abs(new Date(p.created_at).getTime() - t);
    if (diff < bestDiff) { bestDiff = diff; best = p; }
  }
  // accept only when uploaded within 10 min of handover
  return bestDiff <= 10 * 60 * 1000 ? best : null;
}

function HandoverPdfActions({ pdf, onMissing }: { pdf: any | null; onMissing?: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  const ensureUrl = async () => {
    if (url) return url;
    if (!pdf?.file_path) return null;
    const { data, error } = await supabase.storage.from('repair-files').createSignedUrl(pdf.file_path, 600);
    if (error || !data?.signedUrl) { toast({ title: 'Signed URL Fehler', description: error?.message, variant: 'destructive' }); return null; }
    setUrl(data.signedUrl); return data.signedUrl;
  };

  const download = async () => {
    const u = await ensureUrl(); if (!u) return;
    const a = document.createElement('a');
    a.href = u; a.download = pdf.file_name || 'handover.pdf';
    document.body.appendChild(a); a.click(); a.remove();
  };

  const preview = async () => {
    const u = await ensureUrl(); if (!u) return;
    setOpen(true);
  };

  if (!pdf) {
    return (
      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={onMissing} disabled={!onMissing}>
        <FileText className="w-3 h-3 mr-1" /> kein PDF
      </Button>
    );
  }

  return (
    <>
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={preview}>
          <FileText className="w-3 h-3 mr-1" /> Vorschau
        </Button>
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={download}>
          <Upload className="w-3 h-3 mr-1 rotate-180" /> PDF erneut
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl w-[95vw] h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-4 py-2 border-b border-border">
            <DialogTitle className="text-sm flex items-center justify-between">
              <span className="truncate">{pdf.file_name}</span>
              <Button size="sm" variant="outline" className="h-7 ml-2" onClick={download}>Herunterladen</Button>
            </DialogTitle>
          </DialogHeader>
          {url && <iframe src={url} className="flex-1 w-full" title="PDF Vorschau" />}
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 4) Finance-Übergabe (strukturiert, validiert, mit Audit)           */
/* ------------------------------------------------------------------ */
export function FinanceHandoverTab({ repairId, canEdit }: { repairId: string; canEdit: boolean }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [partsTotal, setPartsTotal] = useState(0);
  const [actualCost, setActualCost] = useState<number | null>(null);
  const initial = { total_amount: '', currency: 'EUR', invoice_number: '', notes: '', confirm: false };
  const [n, setN] = useState<any>(initial);
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [pdfReload, setPdfReload] = useState(0);
  const pdfs = useHandoverPdfs(repairId, 'finance_handover_pdf', pdfReload);

  const load = useCallback(async () => {
    const [h, sp, ord] = await Promise.all([
      sbRepair.from('repair_finance_handover').select('*').eq('repair_order_id', repairId).order('handed_over_at', { ascending: false }),
      sbRepair.from('repair_spare_parts').select('quantity,unit_price,status').eq('repair_order_id', repairId),
      sbRepair.from('repair_orders').select('actual_cost,currency').eq('id', repairId).maybeSingle(),
    ]);
    setRows(h.data || []);
    const sum = (sp.data || []).filter((p: any) => p.status !== 'storniert').reduce((s: number, p: any) => s + Number(p.unit_price || 0) * Number(p.quantity || 0), 0);
    setPartsTotal(sum);
    setActualCost(ord.data?.actual_cost ?? null);
  }, [repairId]);
  useEffect(() => { load(); }, [load]);

  const suggested = (actualCost ?? 0) + partsTotal;

  const missingDocs = missingRequiredDocs(FINANCE_CHECKLIST, docs);

  const validate = (): string | null => {
    const amt = Number(n.total_amount);
    if (!n.total_amount || isNaN(amt) || amt <= 0) return 'Gesamtbetrag muss > 0 sein';
    if (!n.invoice_number?.trim()) return 'Rechnungsnummer erforderlich';
    if (missingDocs.length) return `Fehlende Pflichtbelege: ${missingDocs.join(', ')}`;
    if (!n.confirm) return 'Bitte Übergabe-Bestätigung ankreuzen';
    return null;
  };

  const add = async () => {
    const err = validate();
    if (err) return toast({ title: 'Validierung', description: err, variant: 'destructive' });
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const amount = Number(n.total_amount);
    const payload = {
      repair_order_id: repairId, handed_over_by: user?.id,
      total_amount: amount, currency: n.currency,
      invoice_number: n.invoice_number.trim(), notes: n.notes?.trim() || null,
    };
    const { data: ins, error } = await sbRepair.from('repair_finance_handover').insert(payload).select('id').single();
    if (error) { setSaving(false); return toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); }
    await persistChecklistAttachments(repairId, docs, FINANCE_CHECKLIST);
    await sbRepair.from('repair_orders').update({
      sent_to_finance: true, sent_to_finance_at: new Date().toISOString(),
      repair_status: 'An Finance übergeben',
    }).eq('id', repairId);
    await logRepairAudit('repair_finance_handover', repairId, {
      handover_id: ins.id, ...payload,
      documents: docs.map((d) => ({ key: d.key, path: d.path, name: d.name, size: d.size })),
    });
    try {
      await generateHandoverPdf({
        kind: 'finance', repairId, handoverId: ins.id, newStatus: 'An Finance übergeben',
        signaturePath: null, handedOverBy: user?.id,
        metadata: {
          'Gesamtbetrag': `${amount.toFixed(2)} ${n.currency}`,
          'Rechnungsnummer': n.invoice_number.trim(),
          'Notiz': n.notes?.trim() || '',
          'Übergeben am': new Date().toLocaleString('de-DE'),
        },
        checklist: FINANCE_CHECKLIST.map((it) => {
          const d = docs.find((x) => x.key === it.key);
          return { key: it.key, label: it.label, required: it.required, uploaded: !!d, fileName: d?.name, path: d?.path, sizeBytes: d?.size };
        }),
      });
    } catch (e: any) { console.warn('PDF gen failed', e); toast({ title: 'PDF konnte nicht erzeugt werden', description: e?.message, variant: 'destructive' }); }
    toast({ title: 'Finance-Übergabe protokolliert', description: `${amount.toFixed(2)} ${n.currency} · ${n.invoice_number} · PDF heruntergeladen` });
    setN(initial); setDocs([]); setAdding(false); setSaving(false); load();
  };


  const del = async (id: string) => {
    await sbRepair.from('repair_finance_handover').delete().eq('id', id);
    await logRepairAudit('repair_finance_handover_delete', repairId, { handover_id: id });
    load();
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-semibold">Finance-Übergaben</h3>
          <p className="text-xs text-muted-foreground">Strukturierte Protokollierung · jede Übergabe wird im Audit-Log gespeichert.</p>
        </div>
        {canEdit && <Button size="sm" onClick={() => setAdding((s) => !s)}><Plus className="w-4 h-4 mr-1" /> Übergabe protokollieren</Button>}
      </div>

      {adding && (
        <Card className="p-4 bg-muted/30 space-y-3 border-yellow-500/30">
          <div className="text-xs text-muted-foreground">
            Vorschlag aus Diagnose & Ersatzteilen: <b>{suggested.toFixed(2)} €</b>
            {actualCost !== null && <> (Tatsächliche Kosten: {Number(actualCost).toFixed(2)} € · Ersatzteile: {partsTotal.toFixed(2)} €)</>}
            {suggested > 0 && (
              <Button size="sm" variant="ghost" className="ml-2 h-6 text-xs" onClick={() => setN({ ...n, total_amount: suggested.toFixed(2) })}>übernehmen</Button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <F label="Gesamtbetrag *"><Input type="number" step="0.01" min="0.01" value={n.total_amount} onChange={(e) => setN({ ...n, total_amount: e.target.value })} /></F>
            <F label="Währung">
              <Select value={n.currency} onValueChange={(v) => setN({ ...n, currency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['EUR','USD','CHF'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </F>
            <F label="Rechnungsnummer *"><Input value={n.invoice_number} onChange={(e) => setN({ ...n, invoice_number: e.target.value })} placeholder="z. B. RE-2026-0001" /></F>
            <F label="Notiz"><Input value={n.notes} onChange={(e) => setN({ ...n, notes: e.target.value })} /></F>
          </div>
          <label className="flex items-start gap-2 text-xs cursor-pointer">
            <input type="checkbox" checked={n.confirm} onChange={(e) => setN({ ...n, confirm: e.target.checked })} className="mt-0.5" />
            <span>Ich bestätige, dass Betrag und Rechnungsnummer korrekt sind und die Reparatur tatsächlich an Finance übergeben wurde.</span>
          </label>
          <DocChecklist items={FINANCE_CHECKLIST} repairId={repairId} folder="finance-docs" docs={docs} setDocs={setDocs} disabled={saving} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setAdding(false); setN(initial); setDocs([]); }}>Abbrechen</Button>
            <Button size="sm" onClick={add} disabled={saving || missingDocs.length > 0}>
              {saving ? 'Speichere…' : missingDocs.length ? `Belege fehlen (${missingDocs.length})` : 'Übergabe bestätigen'}
            </Button>
          </div>
        </Card>
      )}

      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground uppercase">
          <tr><th className="text-left py-2">Datum</th><th className="text-left">Betrag</th><th className="text-left">Rechnung</th><th className="text-left">Notiz</th><th></th></tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={5} className="text-center py-4 text-muted-foreground text-xs">Keine Übergaben</td></tr>}
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border">
              <td className="py-2 text-xs">{new Date(r.handed_over_at).toLocaleString('de-DE')}</td>
              <td className="text-xs font-semibold">{r.total_amount ? `${Number(r.total_amount).toFixed(2)} ${r.currency}` : '–'}</td>
              <td className="text-xs font-mono">{r.invoice_number || '–'}</td>
              <td className="text-xs">{r.notes || '–'}</td>
              <td className="text-right">{canEdit && <Button size="sm" variant="ghost" onClick={() => del(r.id)}><Trash2 className="w-3 h-3" /></Button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* 5) Auslieferung (validiert, Signatur Pflicht, mit Audit)           */
/* ------------------------------------------------------------------ */
export function DeliveryHandoverTab({ repairId, canEdit }: { repairId: string; canEdit: boolean }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const initial = { recipient_name: '', notes: '', confirm: false };
  const [n, setN] = useState<any>(initial);
  const [sigFile, setSigFile] = useState<File | null>(null);
  const [sigError, setSigError] = useState<string | null>(null);
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const missingDocs = missingRequiredDocs(DELIVERY_CHECKLIST, docs);

  const load = useCallback(async () => {
    const { data } = await sbRepair.from('repair_delivery_handover').select('*').eq('repair_order_id', repairId).order('delivered_at', { ascending: false });
    setRows(data || []);
  }, [repairId]);
  useEffect(() => { load(); }, [load]);

  const onPickSig = (file: File | null) => {
    setSigFile(file);
    setSigError(file ? validateSignatureFile(file) : null);
  };

  const validate = (): string | null => {
    if (!n.recipient_name?.trim()) return 'Empfänger erforderlich';
    if (!sigFile) return 'Signatur / Übergabebeleg erforderlich';
    const sigErr = validateSignatureFile(sigFile);
    if (sigErr) return sigErr;
    if (missingDocs.length) return `Fehlende Pflichtbelege: ${missingDocs.join(', ')}`;
    if (!n.confirm) return 'Bitte Übergabe-Bestätigung ankreuzen';
    return null;
  };

  const add = async () => {
    const err = validate();
    if (err) return toast({ title: 'Validierung', description: err, variant: 'destructive' });
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const path = `${repairId}/delivery-signatures/${Date.now()}-${sigFile!.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error: upErr } = await supabase.storage.from('repair-files').upload(path, sigFile!, { contentType: sigFile!.type });
    if (upErr) { setSaving(false); return toast({ title: 'Signatur-Upload fehlgeschlagen', description: upErr.message, variant: 'destructive' }); }

    const payload = {
      repair_order_id: repairId, delivered_by: user?.id,
      recipient_name: n.recipient_name.trim(), notes: n.notes?.trim() || null, signature_path: path,
    };
    const { data: ins, error } = await sbRepair.from('repair_delivery_handover').insert(payload).select('id').single();
    if (error) { setSaving(false); return toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); }

    await sbRepair.from('repair_signatures').insert({
      repair_order_id: repairId, kind: 'delivery', signer_name: n.recipient_name.trim(),
      storage_path: path, signed_at: new Date().toISOString(),
    });
    await sbRepair.from('repair_orders').update({
      repair_status: 'Ausgeliefert', handover_signature_path: path,
    }).eq('id', repairId);
    await persistChecklistAttachments(repairId, docs, DELIVERY_CHECKLIST);
    await logRepairAudit('repair_delivery_handover', repairId, {
      handover_id: ins.id, recipient_name: payload.recipient_name,
      signature_size: sigFile!.size, signature_mime: sigFile!.type, signature_path: path,
      documents: docs.map((d) => ({ key: d.key, path: d.path, name: d.name, size: d.size })),
    });
    try {
      await generateHandoverPdf({
        kind: 'delivery', repairId, handoverId: ins.id, newStatus: 'Ausgeliefert',
        signaturePath: path, handedOverBy: user?.id,
        metadata: {
          'Empfänger': payload.recipient_name,
          'Notiz': n.notes?.trim() || '',
          'Signatur-Mime': sigFile!.type,
          'Signatur-Größe': `${Math.round(sigFile!.size / 1024)} KB`,
          'Übergeben am': new Date().toLocaleString('de-DE'),
        },
        checklist: DELIVERY_CHECKLIST.map((it) => {
          const d = docs.find((x) => x.key === it.key);
          return { key: it.key, label: it.label, required: it.required, uploaded: !!d, fileName: d?.name, path: d?.path, sizeBytes: d?.size };
        }),
      });
    } catch (e: any) { console.warn('PDF gen failed', e); toast({ title: 'PDF konnte nicht erzeugt werden', description: e?.message, variant: 'destructive' }); }
    toast({ title: 'Auslieferung erfasst', description: `Empfänger: ${payload.recipient_name} · PDF heruntergeladen` });
    setN(initial); setSigFile(null); setSigError(null); setDocs([]); setAdding(false); setSaving(false); load();
  };

  const viewSig = async (path: string) => {
    const { data } = await supabase.storage.from('repair-files').createSignedUrl(path, 600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const del = async (r: any) => {
    if (r.signature_path) await supabase.storage.from('repair-files').remove([r.signature_path]);
    await sbRepair.from('repair_delivery_handover').delete().eq('id', r.id);
    await logRepairAudit('repair_delivery_handover_delete', repairId, { handover_id: r.id });
    load();
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-semibold">Auslieferungen</h3>
          <p className="text-xs text-muted-foreground">Signatur des Empfängers ist Pflicht · Übergabe wird im Audit-Log protokolliert.</p>
        </div>
        {canEdit && <Button size="sm" onClick={() => setAdding((s) => !s)}><Plus className="w-4 h-4 mr-1" /> Auslieferung erfassen</Button>}
      </div>

      {adding && (
        <Card className="p-4 bg-muted/30 space-y-3 border-sky-500/30">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <F label="Empfänger / Übernehmer *"><Input value={n.recipient_name} onChange={(e) => setN({ ...n, recipient_name: e.target.value })} placeholder="Vor- und Nachname" /></F>
            <F label="Notiz"><Input value={n.notes} onChange={(e) => setN({ ...n, notes: e.target.value })} /></F>
          </div>
          <F label="Signatur / Übergabebeleg * (PNG, JPG, WEBP, PDF · max. 5 MB)">
            <Input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(e) => onPickSig(e.target.files?.[0] || null)} />
            {sigFile && !sigError && (
              <p className="text-xs text-emerald-400 mt-1">✓ {sigFile.name} ({Math.round(sigFile.size / 1024)} KB)</p>
            )}
            {sigError && <p className="text-xs text-destructive mt-1">{sigError}</p>}
          </F>
          <label className="flex items-start gap-2 text-xs cursor-pointer">
            <input type="checkbox" checked={n.confirm} onChange={(e) => setN({ ...n, confirm: e.target.checked })} className="mt-0.5" />
            <span>Ich bestätige, dass das Gerät persönlich übergeben und die Signatur des Empfängers eingeholt wurde. Der Reparaturstatus wird auf „Ausgeliefert" gesetzt.</span>
          </label>
          <DocChecklist items={DELIVERY_CHECKLIST} repairId={repairId} folder="delivery-docs" docs={docs} setDocs={setDocs} disabled={saving} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setAdding(false); setN(initial); setSigFile(null); setSigError(null); setDocs([]); }}>Abbrechen</Button>
            <Button size="sm" onClick={add} disabled={saving || !!sigError || missingDocs.length > 0}>
              {saving ? 'Speichere…' : missingDocs.length ? `Belege fehlen (${missingDocs.length})` : 'Auslieferung bestätigen'}
            </Button>
          </div>
        </Card>
      )}

      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground uppercase">
          <tr><th className="text-left py-2">Datum</th><th className="text-left">Empfänger</th><th className="text-left">Notiz</th><th className="text-left">Beleg</th><th></th></tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={5} className="text-center py-4 text-muted-foreground text-xs">Keine Auslieferungen</td></tr>}
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border">
              <td className="py-2 text-xs">{new Date(r.delivered_at).toLocaleString('de-DE')}</td>
              <td className="text-xs font-semibold">{r.recipient_name || '–'}</td>
              <td className="text-xs">{r.notes || '–'}</td>
              <td>{r.signature_path ? <Button size="sm" variant="outline" onClick={() => viewSig(r.signature_path)}>Signatur</Button> : <span className="text-xs text-destructive">fehlt</span>}</td>
              <td className="text-right">{canEdit && <Button size="sm" variant="ghost" onClick={() => del(r)}><Trash2 className="w-3 h-3" /></Button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}


/* ------------------------------------------------------------------ */
/* 6) Anhänge (Metadaten in DB + Storage)                             */
/* ------------------------------------------------------------------ */
export function AttachmentsTab({ repairId, canEdit }: { repairId: string; canEdit: boolean }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState('allgemein');

  const load = useCallback(async () => {
    const { data } = await sbRepair.from('repair_attachments').select('*').eq('repair_order_id', repairId).order('created_at', { ascending: false });
    setRows(data || []);
  }, [repairId]);
  useEffect(() => { load(); }, [load]);

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const path = `${repairId}/attachments/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from('repair-files').upload(path, file);
    if (upErr) { setUploading(false); e.target.value = ''; return toast({ title: 'Upload fehlgeschlagen', description: upErr.message, variant: 'destructive' }); }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await sbRepair.from('repair_attachments').insert({
      repair_order_id: repairId, file_path: path, file_name: file.name,
      mime_type: file.type, size_bytes: file.size, category, uploaded_by: user?.id,
    });
    setUploading(false); e.target.value = '';
    if (error) toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    else load();
  };

  const view = async (path: string) => {
    const { data } = await supabase.storage.from('repair-files').createSignedUrl(path, 600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const del = async (r: any) => {
    await supabase.storage.from('repair-files').remove([r.file_path]);
    await sbRepair.from('repair_attachments').delete().eq('id', r.id);
    load();
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4" /> Anhänge</h3>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>{['allgemein','foto','rechnung','garantie','kva','sonstiges'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
            <label className="cursor-pointer">
              <input type="file" className="hidden" onChange={upload} disabled={uploading} />
              <span className="inline-flex items-center px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm">
                <Upload className="w-4 h-4 mr-1" /> {uploading ? 'Lädt…' : 'Hochladen'}
              </span>
            </label>
          </div>
        )}
      </div>
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground uppercase">
          <tr><th className="text-left py-2">Datei</th><th className="text-left">Kategorie</th><th className="text-left">Größe</th><th className="text-left">Datum</th><th></th></tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={5} className="text-center py-4 text-muted-foreground text-xs">Keine Anhänge</td></tr>}
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border">
              <td className="py-2 text-xs">{r.file_name}</td>
              <td className="text-xs"><span className="px-2 py-0.5 rounded bg-muted">{r.category || 'allgemein'}</span></td>
              <td className="text-xs">{r.size_bytes ? `${Math.round(r.size_bytes / 1024)} KB` : '–'}</td>
              <td className="text-xs">{new Date(r.created_at).toLocaleString('de-DE')}</td>
              <td className="text-right">
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="outline" onClick={() => view(r.file_path)}>Öffnen</Button>
                  {canEdit && <Button size="sm" variant="ghost" onClick={() => del(r)}><Trash2 className="w-3 h-3" /></Button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
