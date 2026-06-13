import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { sbRepair } from '@/lib/repair/api';
import { REPAIR_STATUSES, STATUS_BADGE_CLASS, PART_ORDER_STATUSES } from '@/lib/repair/constants';
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
import { ArrowLeft, Printer, FileDown, Plus, Trash2, Upload, Receipt, MapPin, FileText, MessageSquare } from 'lucide-react';
import { renderRepairWorkOrderPdf, workOrderPdfBase64 } from '@/lib/repair/work-order-pdf';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { ClipboardList, Mail, Download } from 'lucide-react';
import { printRepairReport, repairReportHtmlBlob } from '@/lib/repair/report-pdf';
import { WerkstattAnnahmeTab, WerkstattauftraegeTab, SparePartsTab, FinanceHandoverTab, DeliveryHandoverTab, AttachmentsTab } from './RepairExtraTabs';
import { SparePartRequestDialog } from './SparePartRequestDialog';
import { InvoiceProposalDialog } from './InvoiceProposalDialog';
import { AiAnalysisPanel } from '@/components/ai-service/AiAnalysisPanel';

export default function ReparaturDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const perms = useRepairPermissions();

  const [repair, setRepair] = useState<any>(null);
  const [parts, setParts] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [signatures, setSignatures] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [r, p, h, s] = await Promise.all([
      sbRepair.from('repair_orders').select('*').eq('id', id).maybeSingle(),
      sbRepair.from('repair_parts').select('*').eq('repair_order_id', id).order('created_at'),
      sbRepair.from('repair_status_history').select('*').eq('repair_order_id', id).order('created_at', { ascending: false }),
      sbRepair.from('repair_signatures').select('*').eq('repair_order_id', id).order('created_at', { ascending: false }),
    ]);
    setRepair(r.data);
    setParts(p.data || []);
    setHistory(h.data || []);
    setSignatures(s.data || []);
    // Storage-Dateien (Bucket: repair-files, Prefix: <id>/files/)
    const { data: fl } = await supabase.storage.from('repair-files').list(`${id}/files`, { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });
    setFiles(fl || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const nav = useNavigate();
  const updateRepair = async (patch: any, opts?: { closeAfter?: boolean }) => {
    const { error } = await sbRepair.from('repair_orders').update(patch).eq('id', id);
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Gespeichert', description: 'Reparaturauftrag aktualisiert.' });
    if (opts?.closeAfter) {
      nav('/reparatur/auftraege');
    } else {
      load();
    }
  };

  if (loading) return <Card className="p-8 text-center text-muted-foreground">Lade…</Card>;
  if (!repair) return <Card className="p-8 text-center text-muted-foreground">Reparatur nicht gefunden.</Card>;

  const device = [repair.device_brand, repair.device_model].filter(Boolean).join(' ') || repair.device_category || '–';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/reparatur/auftraege"><Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Zurück</Button></Link>
        <h2 className="text-xl font-bold font-mono">{repair.repair_number}</h2>
        <span className={`px-2 py-0.5 rounded text-xs ${STATUS_BADGE_CLASS[repair.repair_status] || 'bg-muted'}`}>{repair.repair_status}</span>
        <span className="text-xs text-muted-foreground">{repair.customer_name} · {device}</span>
        {repair.ticket_id && (
          <Link to={`/tickets/${repair.ticket_id}`}>
            <Button variant="outline" size="sm" className="border-primary/40 text-primary hover:bg-primary/10">
              <MessageSquare className="w-4 h-4 mr-1" /> Ursprüngliches Ticket
            </Button>
          </Link>
        )}
        {perms.canEditTechnik && <SparePartRequestDialog repair={repair} onCreated={load} />}
        {(perms.canEditTechnik || perms.canEditFinance) && <InvoiceProposalDialog repair={repair} onCreated={load} />}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <ClipboardList className="w-4 h-4 mr-1" /> Arbeitsauftrag
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              onClick={async () => {
                try {
                  const { data: wo } = await sbRepair.from('repair_work_orders')
                    .select('*').eq('repair_order_id', repair.id).order('created_at', { ascending: true });
                  await renderRepairWorkOrderPdf({ repair, parts, workOrders: wo || [] }, 'download');
                } catch (e: any) {
                  toast({ title: 'Fehler', description: e.message, variant: 'destructive' });
                }
              }}
            >
              <Download className="w-4 h-4 mr-2" /> Herunterladen
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={async () => {
                try {
                  const to = (repair.customer_email || '').trim();
                  if (!to) {
                    toast({ title: 'Keine E-Mail', description: 'Beim Kunden ist keine E-Mail hinterlegt.', variant: 'destructive' });
                    return;
                  }
                  const { data: wo } = await sbRepair.from('repair_work_orders')
                    .select('*').eq('repair_order_id', repair.id).order('created_at', { ascending: true });
                  const { base64, fileName } = await workOrderPdfBase64({ repair, parts, workOrders: wo || [] });
                  const device = [repair.device_brand, repair.device_model].filter(Boolean).join(' ') || repair.device_category || '–';
                  const subject = `Arbeitsauftrag ${repair.repair_number || ''}`.trim();
                  const html = `
                    <div style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:640px">
                      <p>Sehr geehrte/r ${repair.customer_contact || repair.customer_name || 'Kund:in'},</p>
                      <p>im Anhang erhalten Sie den aktuellen <b>Arbeitsauftrag</b> zu Ihrer Reparatur <b>${repair.repair_number || ''}</b>.</p>
                      <p style="color:#666">Gerät: ${device}${repair.device_serial_number ? ` · SN ${repair.device_serial_number}` : ''}</p>
                      <p style="margin-top:18px">Mit besten Grüßen<br><b>Ihr Alix Lasers Service-Team</b></p>
                    </div>`;
                  const { error } = await supabase.functions.invoke('send-mail', {
                    body: {
                      to_email: to,
                      to_name: repair.customer_name || undefined,
                      from_email: 'service@alixwork.de',
                      subject,
                      body_html: html,
                      body_text: `Arbeitsauftrag ${repair.repair_number || ''} im Anhang.`,
                      repair_id: repair.id,
                      customer_id: repair.customer_id || undefined,
                      attachments: [{ filename: fileName, content: base64, content_type: 'application/pdf' }],
                    },
                  });
                  if (error) throw error;
                  toast({ title: 'E-Mail gesendet', description: `Arbeitsauftrag an ${to} versendet.` });
                } catch (e: any) {
                  toast({ title: 'Fehler', description: e.message, variant: 'destructive' });
                }
              }}
            >
              <Mail className="w-4 h-4 mr-2" /> Per E-Mail senden
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              const blob = repairReportHtmlBlob({ repair, parts, history });
              const fileName = `Reparaturbericht-${repair.repair_number ?? repair.id}.pdf`;
              const path = `${repair.id}/reports/repair-report-${Date.now()}.pdf`;
              const { error: upErr } = await supabase.storage
                .from('repair-files')
                .upload(path, blob, { contentType: 'application/pdf', upsert: true });
              if (upErr) throw upErr;
              await sbRepair.from('repair_orders').update({ report_pdf_path: path }).eq('id', repair.id);
              // Direct download in browser
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = fileName;
              document.body.appendChild(a); a.click(); a.remove();
              setTimeout(() => URL.revokeObjectURL(url), 2000);
              toast({ title: 'Reparaturbericht erzeugt', description: 'PDF wurde gespeichert und heruntergeladen.' });
              load();
            } catch (e: any) {
              toast({ title: 'Fehler', description: e.message, variant: 'destructive' });
            }
          }}
        >
          <FileText className="w-4 h-4 mr-1" /> Reparaturbericht erzeugen
        </Button>
        {repair.report_pdf_path && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const { data } = await supabase.storage.from('repair-files').createSignedUrl(repair.report_pdf_path, 600);
                if (data?.signedUrl) window.open(data.signedUrl, '_blank');
              }}
            >
              <FileDown className="w-4 h-4 mr-1" /> Bericht öffnen
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const fileName = `Reparaturbericht-${repair.repair_number ?? repair.id}.pdf`;
                const { data, error } = await supabase.storage
                  .from('repair-files')
                  .createSignedUrl(repair.report_pdf_path, 600, { download: fileName });
                if (error || !data?.signedUrl) {
                  toast({ title: 'Fehler', description: error?.message ?? 'Download fehlgeschlagen', variant: 'destructive' });
                  return;
                }
                const a = document.createElement('a');
                a.href = data.signedUrl; a.download = fileName;
                document.body.appendChild(a); a.click(); a.remove();
              }}
            >
              <FileDown className="w-4 h-4 mr-1" /> Bericht herunterladen
            </Button>
          </>
        )}
        <AiAnalysisPanel sourceKind="repair" recordId={repair.id} />
        <div className="ml-auto flex items-center gap-2">
          <Label className="text-xs">Status:</Label>
          <Select value={repair.repair_status} onValueChange={(v) => updateRepair({ repair_status: v })} disabled={!perms.canEditAnnahme}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>{REPAIR_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="annahme">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="annahme">Stammdaten</TabsTrigger>
          <TabsTrigger value="werkstatt">Werkstattannahme</TabsTrigger>
          <TabsTrigger value="technik">Diagnose & Kosten</TabsTrigger>
          <TabsTrigger value="auftraege">Werkstattaufträge</TabsTrigger>
          <TabsTrigger value="ersatzteile">Ersatzteile ({parts.length})</TabsTrigger>
          <TabsTrigger value="spareparts">Bestellungen</TabsTrigger>
          <TabsTrigger value="kv">Kostenvoranschlag</TabsTrigger>
          <TabsTrigger value="finance">Finance</TabsTrigger>
          <TabsTrigger value="delivery">Auslieferung</TabsTrigger>
          <TabsTrigger value="uebergabe">Übergaben</TabsTrigger>
          <TabsTrigger value="anhaenge">Anhänge</TabsTrigger>
          <TabsTrigger value="dateien">Signaturen</TabsTrigger>
          <TabsTrigger value="verlauf">Verlauf</TabsTrigger>
        </TabsList>

        <TabsContent value="annahme">
          <AnnahmeTab repair={repair} canEdit={perms.canEditAnnahme} onSave={updateRepair} />
        </TabsContent>
        <TabsContent value="werkstatt">
          <WerkstattAnnahmeTab repairId={id!} canEdit={perms.canEditWerkstatt} />
        </TabsContent>
        <TabsContent value="technik">
          <TechnikTab repair={repair} parts={parts} canEdit={perms.canEditTechnik} onSave={updateRepair} />
        </TabsContent>
        <TabsContent value="auftraege">
          <WerkstattauftraegeTab repairId={id!} canEdit={perms.canEditTechnik} />
        </TabsContent>
        <TabsContent value="ersatzteile">
          <ErsatzteileTab repairId={id!} parts={parts} canEdit={perms.canEditErsatzteile} onChanged={load} />
        </TabsContent>
        <TabsContent value="spareparts">
          <SparePartsTab repairId={id!} canEdit={perms.canEditErsatzteile} />
        </TabsContent>
        <TabsContent value="kv">
          <KostenvoranschlagTab repair={repair} canEdit={perms.canEditQuotes} />
        </TabsContent>
        <TabsContent value="finance">
          <FinanceHandoverTab repairId={id!} canEdit={perms.canEditFinance} />
        </TabsContent>
        <TabsContent value="delivery">
          <DeliveryHandoverTab repairId={id!} canEdit={perms.canEditTouren} />
        </TabsContent>
        <TabsContent value="uebergabe">
          <UebergabeTab repair={repair} canEditFinance={perms.canEditFinance} canEditTouren={perms.canEditTouren} onSave={updateRepair} />
        </TabsContent>
        <TabsContent value="anhaenge">
          <AttachmentsTab repairId={id!} canEdit={perms.canEditAnnahme} />
        </TabsContent>
        <TabsContent value="dateien">
          <DateienTab repairId={id!} files={files} signatures={signatures} canEdit={perms.canEditAnnahme} onChanged={load} />
        </TabsContent>

        <TabsContent value="verlauf">
          <Card className="p-4">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground uppercase">
                <tr><th className="text-left py-2">Datum</th><th className="text-left">Von</th><th className="text-left">Nach</th><th className="text-left">Notiz</th></tr>
              </thead>
              <tbody>
                {history.length === 0 && <tr><td colSpan={4} className="text-center py-4 text-muted-foreground text-xs">Kein Verlauf</td></tr>}
                {history.map((h) => (
                  <tr key={h.id} className="border-t border-border">
                    <td className="py-2 text-xs">{new Date(h.created_at).toLocaleString('de-DE')}</td>
                    <td className="text-xs">{h.old_status || '–'}</td>
                    <td className="text-xs"><span className={`px-2 py-0.5 rounded ${STATUS_BADGE_CLASS[h.new_status] || 'bg-muted'}`}>{h.new_status}</span></td>
                    <td className="text-xs">{h.change_note}</td>
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
  const [f, setF] = useState<any>(repair);
  useEffect(() => setF(repair), [repair]);
  const upd = (k: string, v: any) => setF({ ...f, [k]: v });
  return (
    <Card className="p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Kunde / Firma"><Input value={f.customer_name || ''} onChange={(e) => upd('customer_name', e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Firma"><Input value={f.customer_company || ''} onChange={(e) => upd('customer_company', e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Ansprechpartner"><Input value={f.customer_contact || ''} onChange={(e) => upd('customer_contact', e.target.value)} disabled={!canEdit} /></Field>
        <Field label="E-Mail"><Input value={f.customer_email || ''} onChange={(e) => upd('customer_email', e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Telefon"><Input value={f.customer_phone || ''} onChange={(e) => upd('customer_phone', e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Zoho-Auftragsnr."><Input value={f.order_number || ''} disabled /></Field>
        <Field label="Priorität">
          <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={f.priority || 'normal'} onChange={(e) => upd('priority', e.target.value)} disabled={!canEdit}>
            <option value="niedrig">Niedrig</option><option value="normal">Normal</option><option value="hoch">Hoch</option><option value="dringend">Dringend</option>
          </select>
        </Field>
        <Field label="Straße / Nr." className="md:col-span-2"><Input value={f.address_street || ''} onChange={(e) => upd('address_street', e.target.value)} disabled={!canEdit} /></Field>
        <Field label="PLZ"><Input value={f.address_zip || ''} onChange={(e) => upd('address_zip', e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Ort"><Input value={f.address_city || ''} onChange={(e) => upd('address_city', e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Land"><Input value={f.address_country || ''} onChange={(e) => upd('address_country', e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Gerätetyp"><Input value={f.device_type || ''} onChange={(e) => upd('device_type', e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Gerätekategorie"><Input value={f.device_category || ''} onChange={(e) => upd('device_category', e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Marke"><Input value={f.device_brand || ''} onChange={(e) => upd('device_brand', e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Modell"><Input value={f.device_model || ''} onChange={(e) => upd('device_model', e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Seriennummer"><Input value={f.device_serial_number || ''} onChange={(e) => upd('device_serial_number', e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Kaufdatum"><Input type="date" value={f.purchase_date || ''} onChange={(e) => upd('purchase_date', e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Gerät schaltet ein?">
          <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={f.powers_on === null || f.powers_on === undefined ? '' : String(f.powers_on)} onChange={(e) => upd('powers_on', e.target.value === '' ? null : e.target.value === 'true')} disabled={!canEdit}>
            <option value="">– unbekannt –</option><option value="true">Ja</option><option value="false">Nein</option>
          </select>
        </Field>
        <Field label="Fehler permanent?">
          <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={f.error_permanent === null || f.error_permanent === undefined ? '' : String(f.error_permanent)} onChange={(e) => upd('error_permanent', e.target.value === '' ? null : e.target.value === 'true')} disabled={!canEdit}>
            <option value="">– unbekannt –</option><option value="true">Ja, dauerhaft</option><option value="false">Sporadisch</option>
          </select>
        </Field>
        <Field label="Zubehör" className="md:col-span-3"><Input value={f.accessories || ''} onChange={(e) => upd('accessories', e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Sichtbare Schäden" className="md:col-span-3"><Textarea rows={2} value={f.visible_damages || ''} onChange={(e) => upd('visible_damages', e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Fehlerbeschreibung Kunde" className="md:col-span-3"><Textarea rows={3} value={f.customer_error_description || f.issue_description || ''} onChange={(e) => upd('customer_error_description', e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Interne Notizen" className="md:col-span-3"><Textarea rows={2} value={f.internal_notes || ''} onChange={(e) => upd('internal_notes', e.target.value)} disabled={!canEdit} /></Field>
      </div>
      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={() => onSave({
            customer_name: f.customer_name, customer_company: f.customer_company, customer_contact: f.customer_contact,
            customer_email: f.customer_email, customer_phone: f.customer_phone,
            address_street: f.address_street, address_zip: f.address_zip, address_city: f.address_city, address_country: f.address_country,
            priority: f.priority,
            device_type: f.device_type, device_category: f.device_category, device_brand: f.device_brand, device_model: f.device_model,
            device_serial_number: f.device_serial_number, purchase_date: f.purchase_date || null,
            accessories: f.accessories, visible_damages: f.visible_damages,
            powers_on: f.powers_on, error_permanent: f.error_permanent,
            customer_error_description: f.customer_error_description,
            issue_description: f.customer_error_description || f.issue_description,
            internal_notes: f.internal_notes,
          }, { closeAfter: true })}>Speichern & schließen</Button>
        </div>
      )}
    </Card>
  );
}


function TechnikTab({ repair, parts, canEdit, onSave }: any) {
  const [f, setF] = useState(repair);
  useEffect(() => setF(repair), [repair]);
  const upd = (k: string, v: any) => setF({ ...f, [k]: v });

  const downloadPdf = () => renderRepairWorkOrderPdf({ repair: f, parts }, 'download');
  const printPdf = () => renderRepairWorkOrderPdf({ repair: f, parts }, 'print');

  return (
    <Card className="p-4 space-y-4">
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={downloadPdf}><FileDown className="w-4 h-4 mr-1" /> Arbeitsauftrag</Button>
        <Button variant="outline" size="sm" onClick={printPdf}><Printer className="w-4 h-4 mr-1" /> Drucken</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Diagnose (Techniker)" className="md:col-span-2">
          <Textarea rows={5} value={f.diagnosis || ''} onChange={(e) => upd('diagnosis', e.target.value)} disabled={!canEdit} />
        </Field>
        <Field label="Kostenvoranschlag">
          <Input type="number" step="0.01" value={f.estimated_cost ?? ''} onChange={(e) => upd('estimated_cost', e.target.value === '' ? null : Number(e.target.value))} disabled={!canEdit} />
        </Field>
        <Field label="Tatsächliche Kosten">
          <Input type="number" step="0.01" value={f.actual_cost ?? ''} onChange={(e) => upd('actual_cost', e.target.value === '' ? null : Number(e.target.value))} disabled={!canEdit} />
        </Field>
        <Field label="Währung">
          <Select value={f.currency || 'EUR'} onValueChange={(v) => upd('currency', v)} disabled={!canEdit}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{['EUR','USD','CHF'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
      </div>
      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={() => onSave({ diagnosis: f.diagnosis, estimated_cost: f.estimated_cost, actual_cost: f.actual_cost, currency: f.currency })}>
            Speichern
          </Button>
        </div>
      )}
    </Card>
  );
}

function ErsatzteileTab({ repairId, parts, canEdit, onChanged }: any) {
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [n, setN] = useState({ item_name: '', sku: '', quantity: 1, supplier_name: '', notes: '', order_status: 'offen' });

  const addPart = async () => {
    if (!n.item_name) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await sbRepair.from('repair_parts').insert({ ...n, repair_order_id: repairId, created_by: user?.id, updated_by: user?.id });
    if (error) return toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    setN({ item_name: '', sku: '', quantity: 1, supplier_name: '', notes: '', order_status: 'offen' });
    setAdding(false);
    onChanged();
  };

  const setPartStatus = async (pid: string, status: string) => {
    const patch: any = { order_status: status };
    if (status === 'erhalten') { patch.received = true; patch.received_at = new Date().toISOString(); }
    await sbRepair.from('repair_parts').update(patch).eq('id', pid);
    onChanged();
  };

  const deletePart = async (pid: string) => {
    await sbRepair.from('repair_parts').delete().eq('id', pid);
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
            <Input placeholder="Bezeichnung *" value={n.item_name} onChange={(e) => setN({ ...n, item_name: e.target.value })} />
            <Input placeholder="SKU" value={n.sku} onChange={(e) => setN({ ...n, sku: e.target.value })} />
            <Input type="number" placeholder="Menge" value={n.quantity} onChange={(e) => setN({ ...n, quantity: parseInt(e.target.value) || 1 })} />
            <Input placeholder="Lieferant" value={n.supplier_name} onChange={(e) => setN({ ...n, supplier_name: e.target.value })} />
            <Input placeholder="Notiz" value={n.notes} onChange={(e) => setN({ ...n, notes: e.target.value })} className="md:col-span-3" />
            <Select value={n.order_status} onValueChange={(v) => setN({ ...n, order_status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PART_ORDER_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={() => setAdding(false)}>Abbrechen</Button>
            <Button size="sm" onClick={addPart}>Speichern</Button>
          </div>
        </Card>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground uppercase">
            <tr><th className="text-left py-2">Bezeichnung</th><th className="text-left">SKU</th><th className="text-left">Menge</th><th className="text-left">Lieferant</th><th className="text-left">Status</th><th className="text-left">Erhalten</th><th></th></tr>
          </thead>
          <tbody>
            {parts.length === 0 && <tr><td colSpan={7} className="text-center py-4 text-muted-foreground text-xs">Noch keine Ersatzteile</td></tr>}
            {parts.map((p: any) => (
              <tr key={p.id} className="border-t border-border">
                <td className="py-2">{p.item_name}</td>
                <td className="text-xs font-mono">{p.sku || '–'}</td>
                <td>{p.quantity}</td>
                <td className="text-xs">{p.supplier_name || '–'}</td>
                <td>
                  {canEdit ? (
                    <Select value={p.order_status || 'offen'} onValueChange={(v) => setPartStatus(p.id, v)}>
                      <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>{PART_ORDER_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : <span className="text-xs">{p.order_status}</span>}
                </td>
                <td className="text-xs">{p.received_at ? new Date(p.received_at).toLocaleDateString('de-DE') : '–'}</td>
                <td className="text-right">
                  {canEdit && <Button size="sm" variant="ghost" onClick={() => deletePart(p.id)}><Trash2 className="w-3 h-3" /></Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function UebergabeTab({ repair, canEditFinance, canEditTouren, onSave }: any) {
  const toggleFinance = (v: boolean) => {
    onSave({ sent_to_finance: v, sent_to_finance_at: v ? new Date().toISOString() : null, repair_status: v ? 'An Finance übergeben' : repair.repair_status });
  };
  const toggleTouren = (v: boolean) => {
    onSave({ sent_to_route_planning: v, sent_to_route_planning_at: v ? new Date().toISOString() : null, repair_status: v ? 'An Tourenplanung übergeben' : repair.repair_status });
  };
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2"><Receipt className="w-4 h-4 text-yellow-400" /><h3 className="font-semibold">Finance</h3></div>
        <div className="flex items-center justify-between">
          <Label className="text-sm">An Finance übergeben</Label>
          <Switch checked={!!repair.sent_to_finance} onCheckedChange={toggleFinance} disabled={!canEditFinance && !canEditTouren} />
        </div>
        {repair.sent_to_finance_at && (
          <p className="text-xs text-muted-foreground">Übergeben am {new Date(repair.sent_to_finance_at).toLocaleString('de-DE')}</p>
        )}
      </Card>
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-sky-400" /><h3 className="font-semibold">Tourenplanung</h3></div>
        <div className="flex items-center justify-between">
          <Label className="text-sm">An Tourenplanung übergeben</Label>
          <Switch checked={!!repair.sent_to_route_planning} onCheckedChange={toggleTouren} disabled={!canEditTouren} />
        </div>
        {repair.sent_to_route_planning_at && (
          <p className="text-xs text-muted-foreground">Übergeben am {new Date(repair.sent_to_route_planning_at).toLocaleString('de-DE')}</p>
        )}
      </Card>
    </div>
  );
}

function DateienTab({ repairId, files, signatures, canEdit, onChanged }: any) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `${repairId}/files/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from('repair-files').upload(path, file);
    setUploading(false);
    e.target.value = '';
    if (upErr) return toast({ title: 'Upload fehlgeschlagen', description: upErr.message, variant: 'destructive' });
    onChanged();
  };

  const view = async (name: string) => {
    const path = `${repairId}/files/${name}`;
    const { data } = await supabase.storage.from('repair-files').createSignedUrl(path, 600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const viewSignature = async (storagePath: string) => {
    const { data } = await supabase.storage.from('repair-files').createSignedUrl(storagePath, 600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4" /> Dateien</h3>
          {canEdit && (
            <label className="cursor-pointer">
              <input type="file" className="hidden" onChange={handleFile} disabled={uploading} />
              <span className="inline-flex items-center px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm">
                <Upload className="w-4 h-4 mr-1" /> {uploading ? 'Lädt…' : 'Datei hochladen'}
              </span>
            </label>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground uppercase">
              <tr><th className="text-left py-2">Datei</th><th className="text-left">Größe</th><th className="text-left">Hochgeladen</th><th></th></tr>
            </thead>
            <tbody>
              {files.length === 0 && <tr><td colSpan={4} className="text-center py-4 text-muted-foreground text-xs">Keine Dateien</td></tr>}
              {files.map((f: any) => (
                <tr key={f.name} className="border-t border-border">
                  <td className="py-2 text-xs">{f.name}</td>
                  <td className="text-xs">{f.metadata?.size ? `${Math.round(f.metadata.size / 1024)} KB` : '–'}</td>
                  <td className="text-xs">{f.created_at ? new Date(f.created_at).toLocaleString('de-DE') : '–'}</td>
                  <td className="text-right"><Button size="sm" variant="outline" onClick={() => view(f.name)}>Öffnen</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="font-semibold">Signaturen</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground uppercase">
              <tr><th className="text-left py-2">Typ</th><th className="text-left">Unterzeichner</th><th className="text-left">Datum</th><th></th></tr>
            </thead>
            <tbody>
              {signatures.length === 0 && <tr><td colSpan={4} className="text-center py-4 text-muted-foreground text-xs">Keine Signaturen erfasst</td></tr>}
              {signatures.map((s: any) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="py-2 text-xs">{s.kind}</td>
                  <td className="text-xs">{s.signer_name || '–'}</td>
                  <td className="text-xs">{s.signed_at ? new Date(s.signed_at).toLocaleString('de-DE') : '–'}</td>
                  <td className="text-right">{s.storage_path && <Button size="sm" variant="outline" onClick={() => viewSignature(s.storage_path)}>Öffnen</Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><Label className="text-xs">{label}</Label><div className="mt-1">{children}</div></div>;
}

function KostenvoranschlagTab({ repair, canEdit }: any) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await sbRepair
      .from('repair_quotes')
      .select('id, quote_number, status, total_gross, created_at, sent_at, decided_at')
      .eq('repair_order_id', repair.id)
      .order('created_at', { ascending: false });
    setQuotes(data || []);
    setLoading(false);
  }, [repair.id]);

  useEffect(() => { load(); }, [load]);

  const createQuote = async () => {
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await sbRepair
      .from('repair_quotes')
      .insert({
        repair_order_id: repair.id,
        status: 'Entwurf',
        currency: repair.currency || 'EUR',
        vat_rate: 19,
        created_by: user?.id,
      })
      .select('id')
      .single();
    setCreating(false);
    if (error) return toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    navigate(`/reparatur/kostenvoranschlaege/${data.id}`);
  };

  const STATUS: Record<string, string> = {
    'Entwurf': 'bg-muted text-muted-foreground',
    'Versendet': 'bg-blue-500/20 text-blue-300 border border-blue-500/40',
    'Freigegeben': 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
    'Abgelehnt': 'bg-red-500/20 text-red-300 border border-red-500/40',
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold flex items-center gap-2"><Receipt className="w-4 h-4" /> Kostenvoranschläge</h3>
        {canEdit && (
          <Button size="sm" onClick={createQuote} disabled={creating}>
            <Plus className="w-4 h-4 mr-1" /> Neuer KV
          </Button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground uppercase">
            <tr>
              <th className="text-left py-2">KV-Nr.</th>
              <th className="text-left">Status</th>
              <th className="text-right">Brutto</th>
              <th className="text-left">Erstellt</th>
              <th className="text-left">Versendet</th>
              <th className="text-left">Entschieden</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="text-center py-4 text-muted-foreground text-xs">Lädt…</td></tr>}
            {!loading && quotes.length === 0 && (
              <tr><td colSpan={7} className="text-center py-4 text-muted-foreground text-xs">Noch keine Kostenvoranschläge</td></tr>
            )}
            {quotes.map((q) => (
              <tr key={q.id} className="border-t border-border">
                <td className="py-2 font-mono text-xs">{q.quote_number}</td>
                <td><span className={`px-2 py-0.5 rounded text-xs ${STATUS[q.status] || 'bg-muted'}`}>{q.status}</span></td>
                <td className="text-right tabular-nums">{Number(q.total_gross || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
                <td className="text-xs">{new Date(q.created_at).toLocaleDateString('de-DE')}</td>
                <td className="text-xs">{q.sent_at ? new Date(q.sent_at).toLocaleDateString('de-DE') : '–'}</td>
                <td className="text-xs">{q.decided_at ? new Date(q.decided_at).toLocaleDateString('de-DE') : '–'}</td>
                <td className="text-right">
                  <Link to={`/reparatur/kostenvoranschlaege/${q.id}`}>
                    <Button size="sm" variant="outline"><FileText className="w-4 h-4 mr-1" /> Öffnen</Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
