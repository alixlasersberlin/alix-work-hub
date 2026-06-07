import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardCheck, FileText, Image as ImageIcon, Loader2, Plus, Trash2, Upload, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { printServiceReport, serviceReportBlob } from '@/lib/dispatch/service-report-pdf';

const TOUR_TYPES = ['Lieferung','Abholung','Rückversand nach Reparatur','Vor-Ort-Reparatur','Wartung','Schulung / Einweisung','Gerätetausch','Ersatzteillieferung'];
const STATUSES = ['Entwurf','Geplant','Bestätigt','Unterwegs','Vor Ort','Erledigt','Fehlgeschlagen','Verschoben','Storniert'];

export function DispatchExecutionTabs({ tour, onReload, canWrite }: { tour: any; onReload: () => void; canWrite: boolean }) {
  const [saving, setSaving] = useState(false);
  const [parts, setParts] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [signature, setSignature] = useState<string | null>(tour.signature_path ? null : null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  // local form state
  const [form, setForm] = useState({
    tour_type: tour.tour_type || '',
    planning_status: tour.planning_status || 'Geplant',
    contact_name: tour.contact_name || '',
    contact_phone: tour.contact_phone || '',
    contact_email: tour.contact_email || '',
    device_model: tour.device_model || '',
    device_serial_number: tour.device_serial_number || '',
    fault_description: tour.fault_description || '',
    work_performed: tour.work_performed || '',
    result_outcome: tour.result_outcome || '',
    next_step: tour.next_step || '',
  });

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: a }] = await Promise.all([
        supabase.from('dispatch_used_parts').select('*').eq('route_plan_id', tour.id).order('created_at'),
        supabase.from('dispatch_attachments').select('*').eq('route_plan_id', tour.id).order('created_at'),
      ]);
      setParts(p ?? []);
      setAttachments(a ?? []);
    })();
  }, [tour.id]);

  async function saveForm() {
    setSaving(true);
    const { error } = await supabase.from('route_plans').update(form).eq('id', tour.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Gespeichert');
    onReload();
  }

  async function setTimestamp(field: 'check_in_at' | 'check_out_at' | 'work_started_at' | 'work_ended_at') {
    const { error } = await supabase.from('route_plans').update({ [field]: new Date().toISOString() }).eq('id', tour.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Zeit erfasst');
    onReload();
  }

  async function addPart() {
    const { data, error } = await supabase.from('dispatch_used_parts').insert({
      route_plan_id: tour.id, part_name: 'Neues Teil', quantity: 1,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    setParts(p => [...p, data]);
  }
  async function updatePart(id: string, patch: any) {
    setParts(p => p.map(x => x.id === id ? { ...x, ...patch } : x));
    await supabase.from('dispatch_used_parts').update(patch).eq('id', id);
  }
  async function removePart(id: string) {
    await supabase.from('dispatch_used_parts').delete().eq('id', id);
    setParts(p => p.filter(x => x.id !== id));
  }

  async function uploadAttachment(file: File) {
    const path = `dispatch/${tour.id}/attachments/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from('repair-files').upload(path, file);
    if (upErr) { toast.error(upErr.message); return; }
    const { data, error } = await supabase.from('dispatch_attachments').insert({
      route_plan_id: tour.id, file_path: path, file_name: file.name, mime_type: file.type,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    setAttachments(a => [...a, data]);
    toast.success('Hochgeladen');
  }

  async function openAttachment(path: string) {
    const { data } = await supabase.storage.from('repair-files').createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }

  // Signature canvas
  function startDraw(e: React.PointerEvent) {
    drawing.current = true;
    const c = canvasRef.current!; const r = c.getBoundingClientRect();
    const ctx = c.getContext('2d')!;
    ctx.beginPath(); ctx.moveTo(e.clientX - r.left, e.clientY - r.top);
  }
  function moveDraw(e: React.PointerEvent) {
    if (!drawing.current) return;
    const c = canvasRef.current!; const r = c.getBoundingClientRect();
    const ctx = c.getContext('2d')!;
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#000';
    ctx.lineTo(e.clientX - r.left, e.clientY - r.top); ctx.stroke();
  }
  function endDraw() { drawing.current = false; }
  function clearSig() {
    const c = canvasRef.current!; const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    setSignature(null);
  }
  async function saveSig() {
    const c = canvasRef.current!;
    c.toBlob(async (blob) => {
      if (!blob) return;
      const path = `dispatch/${tour.id}/signature.png`;
      const { error } = await supabase.storage.from('repair-files').upload(path, blob, { upsert: true, contentType: 'image/png' });
      if (error) { toast.error(error.message); return; }
      await supabase.from('route_plans').update({ signature_path: path }).eq('id', tour.id);
      setSignature(c.toDataURL('image/png'));
      toast.success('Signatur gespeichert');
      onReload();
    }, 'image/png');
  }

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    if (tour.signature_path) {
      supabase.storage.from('repair-files').createSignedUrl(tour.signature_path, 300).then(({ data }) => {
        if (!data?.signedUrl) return;
        const img = new Image();
        img.onload = () => { ctx.drawImage(img, 0, 0, c.width, c.height); setSignature(c.toDataURL('image/png')); };
        img.src = data.signedUrl;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour.id]);

  async function generateAndSaveReport() {
    let sigUrl: string | null = null;
    if (tour.signature_path) {
      const { data } = await supabase.storage.from('repair-files').createSignedUrl(tour.signature_path, 600);
      sigUrl = data?.signedUrl ?? null;
    }
    const data = { tour: { ...tour, ...form }, parts, attachments, signatureDataUrl: sigUrl };
    const blob = serviceReportBlob(data);
    const path = `dispatch/${tour.id}/reports/service-report-${Date.now()}.html`;
    const { error } = await supabase.storage.from('repair-files').upload(path, blob, { upsert: true, contentType: 'text/html' });
    if (error) { toast.error(error.message); return; }
    await supabase.from('route_plans').update({ report_pdf_path: path }).eq('id', tour.id);
    printServiceReport(data);
    toast.success('Servicebericht gespeichert');
    onReload();
  }

  async function openReport() {
    if (!tour.report_pdf_path) return;
    const { data } = await supabase.storage.from('repair-files').createSignedUrl(tour.report_pdf_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }

  return (
    <div className="space-y-6 mt-8">
      {/* Einsatz */}
      <div className="rounded-xl border border-border bg-card p-6 card-glow">
        <h2 className="text-base font-display font-bold flex items-center gap-2 mb-4">
          <ClipboardCheck className="w-4 h-4 text-primary" /> Einsatz
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="text-xs text-muted-foreground">Einsatzart</label>
            <Select value={form.tour_type} onValueChange={v => setForm({ ...form, tour_type: v })} disabled={!canWrite}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Wählen" /></SelectTrigger>
              <SelectContent>{TOUR_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Status</label>
            <Select value={form.planning_status} onValueChange={v => setForm({ ...form, planning_status: v })} disabled={!canWrite}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Ansprechpartner</label>
            <Input value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} className="bg-secondary border-border" disabled={!canWrite}/>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Telefon</label>
            <Input value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} className="bg-secondary border-border" disabled={!canWrite}/>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">E-Mail</label>
            <Input value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} className="bg-secondary border-border" disabled={!canWrite}/>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Gerät</label>
            <Input value={form.device_model} onChange={e => setForm({ ...form, device_model: e.target.value })} className="bg-secondary border-border" disabled={!canWrite}/>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Seriennummer</label>
            <Input value={form.device_serial_number} onChange={e => setForm({ ...form, device_serial_number: e.target.value })} className="bg-secondary border-border" disabled={!canWrite}/>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 mt-4">
          <div>
            <label className="text-xs text-muted-foreground">Fehlerbeschreibung</label>
            <Textarea rows={3} value={form.fault_description} onChange={e => setForm({ ...form, fault_description: e.target.value })} className="bg-secondary border-border" disabled={!canWrite}/>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Durchgeführte Arbeiten</label>
            <Textarea rows={3} value={form.work_performed} onChange={e => setForm({ ...form, work_performed: e.target.value })} className="bg-secondary border-border" disabled={!canWrite}/>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Ergebnis</label>
            <Input value={form.result_outcome} onChange={e => setForm({ ...form, result_outcome: e.target.value })} className="bg-secondary border-border" disabled={!canWrite}/>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Nächster Schritt</label>
            <Input value={form.next_step} onChange={e => setForm({ ...form, next_step: e.target.value })} className="bg-secondary border-border" disabled={!canWrite}/>
          </div>
        </div>

        {canWrite && (
          <div className="flex flex-wrap gap-2 mt-4">
            <Button size="sm" variant="outline" onClick={() => setTimestamp('check_in_at')}>Check-in</Button>
            <Button size="sm" variant="outline" onClick={() => setTimestamp('work_started_at')}>Arbeit Start</Button>
            <Button size="sm" variant="outline" onClick={() => setTimestamp('work_ended_at')}>Arbeit Ende</Button>
            <Button size="sm" variant="outline" onClick={() => setTimestamp('check_out_at')}>Check-out</Button>
            <Button size="sm" className="gold-gradient text-primary-foreground ml-auto" onClick={saveForm} disabled={saving}>
              {saving ? 'Speichern…' : 'Einsatz speichern'}
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 text-xs text-muted-foreground">
          <div><b>Check-in:</b> {tour.check_in_at ? new Date(tour.check_in_at).toLocaleString('de-DE') : '—'}</div>
          <div><b>Arbeit Start:</b> {tour.work_started_at ? new Date(tour.work_started_at).toLocaleString('de-DE') : '—'}</div>
          <div><b>Arbeit Ende:</b> {tour.work_ended_at ? new Date(tour.work_ended_at).toLocaleString('de-DE') : '—'}</div>
          <div><b>Check-out:</b> {tour.check_out_at ? new Date(tour.check_out_at).toLocaleString('de-DE') : '—'}</div>
        </div>
      </div>

      {/* Parts */}
      <div className="rounded-xl border border-border bg-card p-6 card-glow">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-display font-bold">Verwendete Ersatzteile</h2>
          {canWrite && <Button size="sm" variant="outline" onClick={addPart}><Plus className="w-3 h-3 mr-1"/>Teil hinzufügen</Button>}
        </div>
        {parts.length === 0 ? <p className="text-muted-foreground text-sm">Keine Teile.</p> : (
          <div className="space-y-2">
            {parts.map(p => (
              <div key={p.id} className="grid grid-cols-12 gap-2 items-center">
                <Input className="col-span-5 bg-secondary border-border" value={p.part_name} onChange={e => updatePart(p.id, { part_name: e.target.value })} disabled={!canWrite}/>
                <Input className="col-span-3 bg-secondary border-border" placeholder="SKU" value={p.part_sku || ''} onChange={e => updatePart(p.id, { part_sku: e.target.value })} disabled={!canWrite}/>
                <Input type="number" className="col-span-2 bg-secondary border-border" value={p.quantity} onChange={e => updatePart(p.id, { quantity: Number(e.target.value) })} disabled={!canWrite}/>
                <Input className="col-span-1 bg-secondary border-border" placeholder="Notiz" value={p.note || ''} onChange={e => updatePart(p.id, { note: e.target.value })} disabled={!canWrite}/>
                {canWrite && <Button size="sm" variant="ghost" onClick={() => removePart(p.id)}><Trash2 className="w-3 h-3 text-destructive"/></Button>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Attachments */}
      <div className="rounded-xl border border-border bg-card p-6 card-glow">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-display font-bold flex items-center gap-2"><ImageIcon className="w-4 h-4 text-primary"/>Fotos & Anhänge</h2>
          {canWrite && (
            <label className="cursor-pointer">
              <input type="file" className="hidden" onChange={e => e.target.files?.[0] && uploadAttachment(e.target.files[0])} />
              <span className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border border-border bg-secondary hover:bg-secondary/80">
                <Upload className="w-3 h-3"/> Hochladen
              </span>
            </label>
          )}
        </div>
        {attachments.length === 0 ? <p className="text-muted-foreground text-sm">Keine Anhänge.</p> : (
          <ul className="space-y-1 text-sm">
            {attachments.map(a => (
              <li key={a.id}>
                <button className="text-primary hover:underline" onClick={() => openAttachment(a.file_path)}>
                  {a.file_name || a.file_path}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Signature */}
      <div className="rounded-xl border border-border bg-card p-6 card-glow">
        <h2 className="text-base font-display font-bold mb-3">Kundenunterschrift</h2>
        <canvas
          ref={canvasRef} width={400} height={150}
          onPointerDown={canWrite ? startDraw : undefined}
          onPointerMove={canWrite ? moveDraw : undefined}
          onPointerUp={endDraw}
          onPointerLeave={endDraw}
          className="border border-border rounded-md bg-white touch-none"
        />
        {canWrite && (
          <div className="flex gap-2 mt-3">
            <Button size="sm" variant="outline" onClick={clearSig}>Löschen</Button>
            <Button size="sm" className="gold-gradient text-primary-foreground" onClick={saveSig}>Signatur speichern</Button>
          </div>
        )}
      </div>

      {/* Report */}
      <div className="rounded-xl border border-border bg-card p-6 card-glow">
        <h2 className="text-base font-display font-bold flex items-center gap-2 mb-4">
          <FileText className="w-4 h-4 text-primary"/>Servicebericht
        </h2>
        <div className="flex gap-2">
          <Button onClick={generateAndSaveReport} className="gold-gradient text-primary-foreground">
            <FileText className="w-4 h-4 mr-2"/>Servicebericht erzeugen
          </Button>
          {tour.report_pdf_path && (
            <Button variant="outline" onClick={openReport}>
              <FileDown className="w-4 h-4 mr-2"/>Bericht öffnen
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
