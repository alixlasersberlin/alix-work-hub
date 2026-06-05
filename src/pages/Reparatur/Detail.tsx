import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { sbRepair } from '@/lib/repair/api';
import { REPAIR_STATUSES, STATUS_BADGE_CLASS, REPAIR_PRIORITIES } from '@/lib/repair/constants';
import { useRepairPermissions } from '@/lib/repair/permissions';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Printer, FileDown, Plus, Trash2, Upload, ShoppingCart } from 'lucide-react';
import { renderRepairWorkOrderPdf } from '@/lib/repair/work-order-pdf';

export default function ReparaturDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const perms = useRepairPermissions();

  const [repair, setRepair] = useState<any>(null);
  const [intake, setIntake] = useState<any>(null);
  const [workOrder, setWorkOrder] = useState<any>(null);
  const [parts, setParts] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [finance, setFinance] = useState<any>(null);
  const [delivery, setDelivery] = useState<any>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [r, i, w, p, h, f, d, a] = await Promise.all([
      sbRepair.from('repair_orders').select('*').eq('id', id).maybeSingle(),
      sbRepair.from('repair_workshop_intake').select('*').eq('repair_id', id).maybeSingle(),
      sbRepair.from('repair_work_orders').select('*').eq('repair_id', id).maybeSingle(),
      sbRepair.from('repair_spare_parts').select('*').eq('repair_id', id).order('created_at'),
      sbRepair.from('repair_status_history').select('*').eq('repair_id', id).order('created_at', { ascending: false }),
      sbRepair.from('repair_finance_handover').select('*').eq('repair_id', id).maybeSingle(),
      sbRepair.from('repair_delivery_handover').select('*').eq('repair_id', id).maybeSingle(),
      sbRepair.from('repair_attachments').select('*').eq('repair_id', id).order('created_at', { ascending: false }),
    ]);
    setRepair(r.data);
    setIntake(i.data);
    setWorkOrder(w.data);
    setParts(p.data || []);
    setHistory(h.data || []);
    setFinance(f.data);
    setDelivery(d.data);
    setAttachments(a.data || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const updateRepair = async (patch: any) => {
    const { error } = await sbRepair.from('repair_orders').update(patch).eq('id', id);
    if (error) toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    else load();
  };

  if (loading) return <Card className="p-8 text-center text-muted-foreground">Lade…</Card>;
  if (!repair) return <Card className="p-8 text-center text-muted-foreground">Reparatur nicht gefunden.</Card>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/reparatur/auftraege"><Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Zurück</Button></Link>
        <h2 className="text-xl font-bold font-mono">{repair.repair_number}</h2>
        <span className={`px-2 py-0.5 rounded text-xs ${STATUS_BADGE_CLASS[repair.status] || 'bg-muted'}`}>{repair.status}</span>
        <span className="text-xs text-muted-foreground">Priorität: {repair.priority}</span>
        <div className="ml-auto flex items-center gap-2">
          <Label className="text-xs">Status ändern:</Label>
          <Select value={repair.status} onValueChange={(v) => updateRepair({ status: v })} disabled={!perms.canEditAnnahme}>
            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>{REPAIR_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="annahme">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="annahme">Annahme</TabsTrigger>
          <TabsTrigger value="werkstatt">Werkstattannahme</TabsTrigger>
          <TabsTrigger value="technik">Technik-Arbeitsauftrag</TabsTrigger>
          <TabsTrigger value="ersatzteile">Ersatzteile</TabsTrigger>
          <TabsTrigger value="finance">Finance</TabsTrigger>
          <TabsTrigger value="touren">Tourenplanung</TabsTrigger>
          <TabsTrigger value="dateien">Dateien</TabsTrigger>
          <TabsTrigger value="verlauf">Verlauf</TabsTrigger>
        </TabsList>

        <TabsContent value="annahme">
          <AnnahmeTab repair={repair} canEdit={perms.canEditAnnahme} onSave={updateRepair} />
        </TabsContent>
        <TabsContent value="werkstatt">
          <WerkstattTab repairId={id!} intake={intake} canEdit={perms.canEditWerkstatt} onChanged={load} />
        </TabsContent>
        <TabsContent value="technik">
          <TechnikTab repair={repair} intake={intake} parts={parts} workOrder={workOrder} canEdit={perms.canEditTechnik} onChanged={load} />
        </TabsContent>
        <TabsContent value="ersatzteile">
          <ErsatzteileTab repair={repair} workOrder={workOrder} parts={parts} canEdit={perms.canEditErsatzteile} onChanged={load} />
        </TabsContent>
        <TabsContent value="finance">
          <FinanceTab repair={repair} finance={finance} parts={parts} canEdit={perms.canEditFinance} onChanged={load} />
        </TabsContent>
        <TabsContent value="touren">
          <TourenTab repair={repair} delivery={delivery} canEdit={perms.canEditTouren} onChanged={load} />
        </TabsContent>
        <TabsContent value="dateien">
          <DateienTab repairId={id!} attachments={attachments} canEdit={perms.canEditAnnahme} onChanged={load} />
        </TabsContent>
        <TabsContent value="verlauf">
          <Card className="p-4">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground uppercase">
                <tr><th className="text-left py-2">Datum</th><th className="text-left">Von</th><th className="text-left">Nach</th><th className="text-left">Notiz</th></tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-t border-border">
                    <td className="py-2 text-xs">{new Date(h.created_at).toLocaleString('de-DE')}</td>
                    <td className="text-xs">{h.old_status || '–'}</td>
                    <td className="text-xs"><span className={`px-2 py-0.5 rounded ${STATUS_BADGE_CLASS[h.new_status] || 'bg-muted'}`}>{h.new_status}</span></td>
                    <td className="text-xs">{h.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AnnahmeTab({ repair, canEdit, onSave }: any) {
  const [f, setF] = useState(repair);
  useEffect(() => setF(repair), [repair]);
  const upd = (k: string, v: any) => setF({ ...f, [k]: v });
  return (
    <Card className="p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Kunde / Firma"><Input value={f.customer_company || ''} onChange={(e) => upd('customer_company', e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Ansprechpartner"><Input value={f.customer_contact || ''} onChange={(e) => upd('customer_contact', e.target.value)} disabled={!canEdit} /></Field>
        <Field label="E-Mail"><Input value={f.customer_email || ''} onChange={(e) => upd('customer_email', e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Telefon"><Input value={f.customer_phone || ''} onChange={(e) => upd('customer_phone', e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Gerätetyp"><Input value={f.device_type || ''} onChange={(e) => upd('device_type', e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Seriennummer"><Input value={f.serial_number || ''} onChange={(e) => upd('serial_number', e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Zubehör"><Input value={f.accessories || ''} onChange={(e) => upd('accessories', e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Priorität">
          <Select value={f.priority} onValueChange={(v) => upd('priority', v)} disabled={!canEdit}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{REPAIR_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Fehlerbeschreibung Kunde" className="md:col-span-2"><Textarea rows={3} value={f.customer_error_description || ''} onChange={(e) => upd('customer_error_description', e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Sichtbare Beschädigungen" className="md:col-span-2"><Textarea rows={2} value={f.visible_damages || ''} onChange={(e) => upd('visible_damages', e.target.value)} disabled={!canEdit} /></Field>
      </div>
      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={() => onSave({
            customer_company: f.customer_company, customer_contact: f.customer_contact,
            customer_email: f.customer_email, customer_phone: f.customer_phone,
            device_type: f.device_type, serial_number: f.serial_number,
            accessories: f.accessories, priority: f.priority,
            customer_error_description: f.customer_error_description, visible_damages: f.visible_damages,
          })}>Speichern</Button>
        </div>
      )}
    </Card>
  );
}

function WerkstattTab({ repairId, intake, canEdit, onChanged }: any) {
  const { toast } = useToast();
  const [f, setF] = useState<any>(intake || { arrival_date: '', condition_on_arrival: '', serial_checked: false, accessories_checked: false, visual_check: '', matches_customer_description: true, internal_note: '' });
  useEffect(() => { if (intake) setF(intake); }, [intake]);
  const upd = (k: string, v: any) => setF({ ...f, [k]: v });

  const save = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const payload = { ...f, repair_id: repairId, updated_by: user?.id };
    if (intake?.id) {
      const { error } = await sbRepair.from('repair_workshop_intake').update(payload).eq('id', intake.id);
      if (error) return toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    } else {
      payload.created_by = user?.id;
      const { error } = await sbRepair.from('repair_workshop_intake').insert(payload);
      if (error) return toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    }
    // Status automatisch fortschreiben
    await sbRepair.from('repair_orders').update({ status: 'Werkstattannahme abgeschlossen' }).eq('id', repairId);
    toast({ title: 'Werkstattannahme gespeichert' });
    onChanged();
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Eingangsdatum"><Input type="date" value={f.arrival_date || ''} onChange={(e) => upd('arrival_date', e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Zustand bei Eingang"><Input value={f.condition_on_arrival || ''} onChange={(e) => upd('condition_on_arrival', e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Seriennummer geprüft"><div className="flex items-center gap-2 h-10"><Switch checked={!!f.serial_checked} onCheckedChange={(v) => upd('serial_checked', v)} disabled={!canEdit} /></div></Field>
        <Field label="Zubehör geprüft"><div className="flex items-center gap-2 h-10"><Switch checked={!!f.accessories_checked} onCheckedChange={(v) => upd('accessories_checked', v)} disabled={!canEdit} /></div></Field>
        <Field label="Sichtprüfung" className="md:col-span-2"><Textarea rows={2} value={f.visual_check || ''} onChange={(e) => upd('visual_check', e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Stimmt mit Kundenbeschreibung überein"><div className="flex items-center gap-2 h-10"><Switch checked={!!f.matches_customer_description} onCheckedChange={(v) => upd('matches_customer_description', v)} disabled={!canEdit} /></div></Field>
        <Field label="Interne Bemerkung" className="md:col-span-2"><Textarea rows={2} value={f.internal_note || ''} onChange={(e) => upd('internal_note', e.target.value)} disabled={!canEdit} /></Field>
      </div>
      {canEdit && <div className="flex justify-end"><Button onClick={save}>Speichern & Status fortschreiben</Button></div>}
    </Card>
  );
}

function TechnikTab({ repair, intake, parts, workOrder, canEdit, onChanged }: any) {
  const { toast } = useToast();
  const [f, setF] = useState<any>(workOrder || { task_description: '', diagnosis: '', error_confirmed: false, root_cause: '', work_performed: '', work_time_minutes: 0, repair_successful: false, test_run_done: false, safety_check_done: false, closing_note: '', technician_signature_name: '' });
  useEffect(() => { if (workOrder) setF(workOrder); }, [workOrder]);
  const upd = (k: string, v: any) => setF({ ...f, [k]: v });

  const save = async (alsoCreate = false) => {
    const { data: { user } } = await supabase.auth.getUser();
    const payload: any = { ...f, repair_id: repair.id, updated_by: user?.id };
    if (alsoCreate && f.technician_signature_name) {
      payload.signed_at = new Date().toISOString();
    }
    if (workOrder?.id) {
      const { error } = await sbRepair.from('repair_work_orders').update(payload).eq('id', workOrder.id);
      if (error) return toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    } else {
      payload.created_by = user?.id;
      const { error } = await sbRepair.from('repair_work_orders').insert(payload);
      if (error) return toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      await sbRepair.from('repair_orders').update({ status: 'Arbeitsauftrag Technik erstellt' }).eq('id', repair.id);
    }
    toast({ title: 'Arbeitsauftrag gespeichert' });
    onChanged();
  };

  const downloadPdf = () => {
    renderRepairWorkOrderPdf({ repair, intake, workOrder: f, parts }, 'download');
  };
  const printPdf = () => {
    renderRepairWorkOrderPdf({ repair, intake, workOrder: f, parts }, 'print');
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={downloadPdf}><FileDown className="w-4 h-4 mr-1" /> PDF</Button>
        <Button variant="outline" size="sm" onClick={printPdf}><Printer className="w-4 h-4 mr-1" /> Drucken</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Aufgabenbeschreibung" className="md:col-span-2"><Textarea rows={2} value={f.task_description || ''} onChange={(e) => upd('task_description', e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Diagnose" className="md:col-span-2"><Textarea rows={3} value={f.diagnosis || ''} onChange={(e) => upd('diagnosis', e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Fehler bestätigt"><div className="flex items-center gap-2 h-10"><Switch checked={!!f.error_confirmed} onCheckedChange={(v) => upd('error_confirmed', v)} disabled={!canEdit} /></div></Field>
        <Field label="Ursache"><Input value={f.root_cause || ''} onChange={(e) => upd('root_cause', e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Durchgeführte Arbeiten" className="md:col-span-2"><Textarea rows={3} value={f.work_performed || ''} onChange={(e) => upd('work_performed', e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Arbeitszeit (Min.)"><Input type="number" value={f.work_time_minutes || 0} onChange={(e) => upd('work_time_minutes', parseInt(e.target.value) || 0)} disabled={!canEdit} /></Field>
        <Field label="Reparatur erfolgreich"><div className="flex items-center gap-2 h-10"><Switch checked={!!f.repair_successful} onCheckedChange={(v) => upd('repair_successful', v)} disabled={!canEdit} /></div></Field>
        <Field label="Testlauf durchgeführt"><div className="flex items-center gap-2 h-10"><Switch checked={!!f.test_run_done} onCheckedChange={(v) => upd('test_run_done', v)} disabled={!canEdit} /></div></Field>
        <Field label="Sicherheitsprüfung durchgeführt"><div className="flex items-center gap-2 h-10"><Switch checked={!!f.safety_check_done} onCheckedChange={(v) => upd('safety_check_done', v)} disabled={!canEdit} /></div></Field>
        <Field label="Abschlussbemerkung" className="md:col-span-2"><Textarea rows={2} value={f.closing_note || ''} onChange={(e) => upd('closing_note', e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Unterschrift Techniker (Name)"><Input value={f.technician_signature_name || ''} onChange={(e) => upd('technician_signature_name', e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Unterschrift am"><Input value={f.signed_at ? new Date(f.signed_at).toLocaleString('de-DE') : ''} disabled /></Field>
      </div>
      {canEdit && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => save(false)}>Speichern</Button>
          <Button onClick={() => save(true)}>Speichern & unterschreiben</Button>
        </div>
      )}
    </Card>
  );
}

function ErsatzteileTab({ repair, workOrder, parts, canEdit, onChanged }: any) {
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [n, setN] = useState({ name: '', sku: '', quantity: 1, reason: '', in_stock: false, urgency: 'Normal', supplier_name: '' });

  const addPart = async () => {
    if (!n.name) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await sbRepair.from('repair_spare_parts').insert({ ...n, repair_id: repair.id, work_order_id: workOrder?.id || null, created_by: user?.id, updated_by: user?.id });
    if (error) return toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    if (!n.in_stock) {
      await sbRepair.from('repair_orders').update({ status: 'Ersatzteile benötigt' }).eq('id', repair.id);
    }
    setN({ name: '', sku: '', quantity: 1, reason: '', in_stock: false, urgency: 'Normal', supplier_name: '' });
    setAdding(false);
    onChanged();
  };

  const deletePart = async (pid: string) => {
    await sbRepair.from('repair_spare_parts').delete().eq('id', pid);
    onChanged();
  };

  const createPurchaseSuggestion = async (p: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    const note = `[Quelle: Reparaturbedarf ${repair.repair_number}] Ersatzteil: ${p.name}${p.sku ? ' (SKU ' + p.sku + ')' : ''} · Menge ${p.quantity}${p.reason ? ' · Grund: ' + p.reason : ''}`;
    // Hänge eine Bestellung im bestehenden Bestellwesen an — wir ändern dort nichts am Schema, nutzen anmerkungen
    const { data, error } = await supabase.from('production_orders').insert({
      order_id: repair.order_id || null,
      order_number: repair.repair_number,
      supplier_id: '00000000-0000-0000-0000-000000000000', // Platzhalter; Anwender setzt Lieferant im Bestellwesen
      modellname: p.name,
      farbe: '–',
      power_handstueck: '–',
      bearbeiter: user?.email || 'Reparaturannahme',
      liefertermin: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      sonderwuensche: p.sku || '',
      anmerkungen: note,
      status: 'offen',
      created_by: user?.id,
    } as any).select('id').single();
    if (error) {
      toast({ title: 'Bestellvorschlag fehlgeschlagen', description: error.message, variant: 'destructive' });
      return;
    }
    await sbRepair.from('repair_spare_parts').update({ ordered_via_production_order_id: data.id, ordered_at: new Date().toISOString() }).eq('id', p.id);
    await sbRepair.from('repair_orders').update({ status: 'Ersatzteile bestellt' }).eq('id', repair.id);
    toast({ title: 'Bestellvorschlag erzeugt', description: 'Im Bestellwesen unter "Reparaturbedarf" sichtbar.' });
    onChanged();
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Ersatzteile</h3>
        {canEdit && <Button size="sm" onClick={() => setAdding((s) => !s)}><Plus className="w-4 h-4 mr-1" /> Hinzufügen</Button>}
      </div>
      {adding && (
        <Card className="p-3 bg-muted/30">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <Input placeholder="Name *" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} />
            <Input placeholder="Artikelnummer" value={n.sku} onChange={(e) => setN({ ...n, sku: e.target.value })} />
            <Input type="number" placeholder="Menge" value={n.quantity} onChange={(e) => setN({ ...n, quantity: parseFloat(e.target.value) || 1 })} />
            <Input placeholder="Lieferant" value={n.supplier_name} onChange={(e) => setN({ ...n, supplier_name: e.target.value })} />
            <Input placeholder="Grund" value={n.reason} onChange={(e) => setN({ ...n, reason: e.target.value })} className="md:col-span-2" />
            <Select value={n.urgency} onValueChange={(v) => setN({ ...n, urgency: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{['Normal','Hoch','Sehr hoch'].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
            </Select>
            <div className="flex items-center gap-2"><Switch checked={n.in_stock} onCheckedChange={(v) => setN({ ...n, in_stock: v })} /><span className="text-xs">Auf Lager</span></div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={() => setAdding(false)}>Abbrechen</Button>
            <Button size="sm" onClick={addPart}>Speichern</Button>
          </div>
        </Card>
      )}
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground uppercase">
          <tr><th className="text-left py-2">Name</th><th className="text-left">SKU</th><th className="text-left">Menge</th><th className="text-left">Grund</th><th className="text-left">Lager</th><th className="text-left">Bestellung</th><th></th></tr>
        </thead>
        <tbody>
          {parts.length === 0 && <tr><td colSpan={7} className="text-center py-4 text-muted-foreground text-xs">Noch keine Ersatzteile</td></tr>}
          {parts.map((p: any) => (
            <tr key={p.id} className="border-t border-border">
              <td className="py-2">{p.name}</td>
              <td className="text-xs font-mono">{p.sku || '–'}</td>
              <td>{p.quantity}</td>
              <td className="text-xs">{p.reason || '–'}</td>
              <td className="text-xs">{p.in_stock ? 'Ja' : 'Nein'}</td>
              <td className="text-xs">{p.ordered_via_production_order_id ? <span className="text-emerald-400">erzeugt</span> : '–'}</td>
              <td className="text-right">
                {canEdit && !p.ordered_via_production_order_id && !p.in_stock && (
                  <Button size="sm" variant="outline" onClick={() => createPurchaseSuggestion(p)}><ShoppingCart className="w-3 h-3 mr-1" /> Bestellvorschlag</Button>
                )}
                {canEdit && <Button size="sm" variant="ghost" onClick={() => deletePart(p.id)}><Trash2 className="w-3 h-3" /></Button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function FinanceTab({ repair, finance, parts, canEdit, onChanged }: any) {
  const { toast } = useToast();
  const [f, setF] = useState<any>(finance || { billing_mode: 'Kostenpflichtig', invoice_proposal_amount: '', invoice_reference: '', notes: '' });
  useEffect(() => { if (finance) setF(finance); }, [finance]);
  const upd = (k: string, v: any) => setF({ ...f, [k]: v });

  const handover = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const payload = { ...f, repair_id: repair.id, handed_over_by: user?.id, updated_by: user?.id };
    if (finance?.id) {
      await sbRepair.from('repair_finance_handover').update(payload).eq('id', finance.id);
    } else {
      payload.created_by = user?.id;
      const { error } = await sbRepair.from('repair_finance_handover').insert(payload);
      if (error) return toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    }
    await sbRepair.from('repair_orders').update({ status: 'Übergabe an Finance' }).eq('id', repair.id);
    toast({ title: 'An Finance übergeben' });
    onChanged();
  };

  const markInvoiceCreated = async () => {
    if (!f.invoice_reference) return toast({ title: 'Rechnungsnummer erforderlich' });
    await sbRepair.from('repair_finance_handover').update({ invoice_created: true, invoice_reference: f.invoice_reference, invoice_created_at: new Date().toISOString() }).eq('id', finance.id);
    await sbRepair.from('repair_orders').update({ status: 'Rechnung erstellt' }).eq('id', repair.id);
    toast({ title: 'Rechnung markiert' });
    onChanged();
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Abrechnungsmodus">
          <Select value={f.billing_mode || 'Kostenpflichtig'} onValueChange={(v) => upd('billing_mode', v)} disabled={!canEdit}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{['Garantie','Kulanz','Kostenpflichtig'].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Rechnungsvorschlag (€)"><Input type="number" value={f.invoice_proposal_amount || ''} onChange={(e) => upd('invoice_proposal_amount', e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Rechnungsnummer"><Input value={f.invoice_reference || ''} onChange={(e) => upd('invoice_reference', e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Notizen" className="md:col-span-2"><Textarea rows={2} value={f.notes || ''} onChange={(e) => upd('notes', e.target.value)} disabled={!canEdit} /></Field>
      </div>
      <Card className="p-3 bg-muted/30 text-xs">
        <p className="font-semibold mb-1">Übergabe-Snapshot</p>
        <p>Reparatur: {repair.repair_number} · Kunde: {repair.customer_company || repair.customer_contact}</p>
        <p>Gerät: {repair.device_type} · Seriennr: {repair.serial_number}</p>
        <p>Ersatzteile: {parts.length}</p>
      </Card>
      {canEdit && (
        <div className="flex justify-end gap-2">
          <Button onClick={handover}>{finance ? 'Aktualisieren' : 'An Finance übergeben'}</Button>
          {finance && <Button variant="outline" onClick={markInvoiceCreated}>Rechnung erstellt</Button>}
        </div>
      )}
    </Card>
  );
}

function TourenTab({ repair, delivery, canEdit, onChanged }: any) {
  const { toast } = useToast();
  const [f, setF] = useState<any>(delivery || { desired_delivery_date: '', delivery_notes: '', invoice_paid: false, mode: 'Lieferung' });
  useEffect(() => { if (delivery) setF(delivery); }, [delivery]);
  const upd = (k: string, v: any) => setF({ ...f, [k]: v });

  const handover = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      ...f,
      repair_id: repair.id,
      handed_over_by: user?.id,
      updated_by: user?.id,
      delivery_address: {
        street: repair.customer_street, zip: repair.customer_zip, city: repair.customer_city, phone: repair.customer_phone,
      },
    };
    if (delivery?.id) {
      await sbRepair.from('repair_delivery_handover').update(payload).eq('id', delivery.id);
    } else {
      payload.created_by = user?.id;
      const { error } = await sbRepair.from('repair_delivery_handover').insert(payload);
      if (error) return toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    }
    await sbRepair.from('repair_orders').update({ status: 'Übergabe an Tourenplanung' }).eq('id', repair.id);
    toast({ title: 'An Tourenplanung übergeben' });
    onChanged();
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Modus">
          <Select value={f.mode || 'Lieferung'} onValueChange={(v) => upd('mode', v)} disabled={!canEdit}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{['Lieferung','Abholung'].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Gewünschter Liefertermin"><Input type="date" value={f.desired_delivery_date || ''} onChange={(e) => upd('desired_delivery_date', e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Rechnung bezahlt"><div className="flex items-center gap-2 h-10"><Switch checked={!!f.invoice_paid} onCheckedChange={(v) => upd('invoice_paid', v)} disabled={!canEdit} /></div></Field>
        <Field label="Hinweise zur Auslieferung" className="md:col-span-2"><Textarea rows={2} value={f.delivery_notes || ''} onChange={(e) => upd('delivery_notes', e.target.value)} disabled={!canEdit} /></Field>
      </div>
      <Card className="p-3 bg-muted/30 text-xs">
        <p>Adresse: {repair.customer_street}, {repair.customer_zip} {repair.customer_city}</p>
        <p>Telefon: {repair.customer_phone}</p>
      </Card>
      {canEdit && <div className="flex justify-end"><Button onClick={handover}>{delivery ? 'Aktualisieren' : 'An Tourenplanung übergeben'}</Button></div>}
    </Card>
  );
}

function DateienTab({ repairId, attachments, canEdit, onChanged }: any) {
  const { toast } = useToast();
  const [phase, setPhase] = useState('annahme');
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `${repairId}/${phase}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from('repair-files').upload(path, file);
    if (upErr) {
      toast({ title: 'Upload fehlgeschlagen', description: upErr.message, variant: 'destructive' });
      setUploading(false);
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    await sbRepair.from('repair_attachments').insert({
      repair_id: repairId, phase, file_path: path, file_name: file.name, file_type: file.type, uploaded_by: user?.id,
    });
    setUploading(false);
    e.target.value = '';
    onChanged();
  };

  const view = async (att: any) => {
    const { data } = await supabase.storage.from('repair-files').createSignedUrl(att.file_path, 600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  return (
    <Card className="p-4 space-y-3">
      {canEdit && (
        <div className="flex items-center gap-2">
          <Select value={phase} onValueChange={setPhase}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>{['annahme','werkstatt','technik','abschluss','sonstiges'].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
          <label className="cursor-pointer">
            <input type="file" className="hidden" onChange={handleFile} disabled={uploading} />
            <span className="inline-flex items-center px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm">
              <Upload className="w-4 h-4 mr-1" /> {uploading ? 'Lädt…' : 'Datei hochladen'}
            </span>
          </label>
        </div>
      )}
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground uppercase">
          <tr><th className="text-left py-2">Datum</th><th className="text-left">Phase</th><th className="text-left">Datei</th><th></th></tr>
        </thead>
        <tbody>
          {attachments.length === 0 && <tr><td colSpan={4} className="text-center py-4 text-muted-foreground text-xs">Keine Dateien</td></tr>}
          {attachments.map((a: any) => (
            <tr key={a.id} className="border-t border-border">
              <td className="py-2 text-xs">{new Date(a.created_at).toLocaleString('de-DE')}</td>
              <td className="text-xs">{a.phase}</td>
              <td className="text-xs">{a.file_name}</td>
              <td className="text-right"><Button size="sm" variant="outline" onClick={() => view(a)}>Öffnen</Button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><Label className="text-xs">{label}</Label><div className="mt-1">{children}</div></div>;
}
