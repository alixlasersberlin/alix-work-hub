import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { sbRepair } from '@/lib/repair/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Upload, FileText } from 'lucide-react';

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
/* 4) Finance-Übergabe (strukturiert, n)                              */
/* ------------------------------------------------------------------ */
export function FinanceHandoverTab({ repairId, canEdit }: { repairId: string; canEdit: boolean }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);
  const [n, setN] = useState<any>({ total_amount: '', currency: 'EUR', invoice_number: '', notes: '' });

  const load = useCallback(async () => {
    const { data } = await sbRepair.from('repair_finance_handover').select('*').eq('repair_order_id', repairId).order('handed_over_at', { ascending: false });
    setRows(data || []);
  }, [repairId]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await sbRepair.from('repair_finance_handover').insert({
      repair_order_id: repairId, handed_over_by: user?.id,
      total_amount: n.total_amount ? Number(n.total_amount) : null,
      currency: n.currency, invoice_number: n.invoice_number || null, notes: n.notes || null,
    });
    if (error) return toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    await sbRepair.from('repair_orders').update({ sent_to_finance: true, sent_to_finance_at: new Date().toISOString() }).eq('id', repairId);
    setN({ total_amount: '', currency: 'EUR', invoice_number: '', notes: '' }); setAdding(false); load();
  };

  const del = async (id: string) => { await sbRepair.from('repair_finance_handover').delete().eq('id', id); load(); };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Finance-Übergaben</h3>
        {canEdit && <Button size="sm" onClick={() => setAdding((s) => !s)}><Plus className="w-4 h-4 mr-1" /> Übergabe protokollieren</Button>}
      </div>
      {adding && (
        <Card className="p-3 bg-muted/30">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <Input type="number" step="0.01" placeholder="Gesamtbetrag" value={n.total_amount} onChange={(e) => setN({ ...n, total_amount: e.target.value })} />
            <Select value={n.currency} onValueChange={(v) => setN({ ...n, currency: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{['EUR','USD','CHF'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Rechnungsnr." value={n.invoice_number} onChange={(e) => setN({ ...n, invoice_number: e.target.value })} />
            <Input placeholder="Notiz" value={n.notes} onChange={(e) => setN({ ...n, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={() => setAdding(false)}>Abbrechen</Button>
            <Button size="sm" onClick={add}>Speichern</Button>
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
              <td className="text-xs">{r.total_amount ? `${r.total_amount} ${r.currency}` : '–'}</td>
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
/* 5) Auslieferung (n)                                                */
/* ------------------------------------------------------------------ */
export function DeliveryHandoverTab({ repairId, canEdit }: { repairId: string; canEdit: boolean }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);
  const [n, setN] = useState<any>({ recipient_name: '', notes: '' });
  const [sigFile, setSigFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    const { data } = await sbRepair.from('repair_delivery_handover').select('*').eq('repair_order_id', repairId).order('delivered_at', { ascending: false });
    setRows(data || []);
  }, [repairId]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    let sigPath: string | null = null;
    if (sigFile) {
      const path = `${repairId}/delivery-signatures/${Date.now()}-${sigFile.name}`;
      const { error: upErr } = await supabase.storage.from('repair-files').upload(path, sigFile);
      if (upErr) return toast({ title: 'Signatur-Upload fehlgeschlagen', description: upErr.message, variant: 'destructive' });
      sigPath = path;
    }
    const { error } = await sbRepair.from('repair_delivery_handover').insert({
      repair_order_id: repairId, delivered_by: user?.id,
      recipient_name: n.recipient_name || null, notes: n.notes || null, signature_path: sigPath,
    });
    if (error) return toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    await sbRepair.from('repair_orders').update({ repair_status: 'Ausgeliefert' }).eq('id', repairId);
    setN({ recipient_name: '', notes: '' }); setSigFile(null); setAdding(false); load();
  };

  const viewSig = async (path: string) => {
    const { data } = await supabase.storage.from('repair-files').createSignedUrl(path, 600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const del = async (id: string) => { await sbRepair.from('repair_delivery_handover').delete().eq('id', id); load(); };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Auslieferungen</h3>
        {canEdit && <Button size="sm" onClick={() => setAdding((s) => !s)}><Plus className="w-4 h-4 mr-1" /> Auslieferung erfassen</Button>}
      </div>
      {adding && (
        <Card className="p-3 bg-muted/30 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Input placeholder="Empfänger / Übernehmer" value={n.recipient_name} onChange={(e) => setN({ ...n, recipient_name: e.target.value })} />
            <Input placeholder="Notiz" value={n.notes} onChange={(e) => setN({ ...n, notes: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Signatur / Übergabebeleg (Bild/PDF)</Label>
            <Input type="file" accept="image/*,application/pdf" onChange={(e) => setSigFile(e.target.files?.[0] || null)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setAdding(false); setSigFile(null); }}>Abbrechen</Button>
            <Button size="sm" onClick={add}>Speichern</Button>
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
              <td className="text-xs">{r.recipient_name || '–'}</td>
              <td className="text-xs">{r.notes || '–'}</td>
              <td>{r.signature_path ? <Button size="sm" variant="outline" onClick={() => viewSig(r.signature_path)}>Öffnen</Button> : <span className="text-xs">–</span>}</td>
              <td className="text-right">{canEdit && <Button size="sm" variant="ghost" onClick={() => del(r.id)}><Trash2 className="w-3 h-3" /></Button>}</td>
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
