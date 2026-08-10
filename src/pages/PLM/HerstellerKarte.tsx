import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PlmFileInput, PlmThumb } from '@/components/plm/PlmFileInput';
import { statusBadge } from '@/components/plm/PlmCrudPage';
import { MFR_DOC_STATUS, MFR_DOC_TYPES, INCOTERMS } from '@/lib/plm/manufacturers';
import { plmLabel } from '@/lib/plm/config';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { ArrowLeft, Building2, Loader2, Plus, Trash2 } from 'lucide-react';

const WRITE_ROLES = ['Super Admin', 'Admin', 'Geschäftsführung', 'Medical', 'Produktion', 'QM'];

const CERTS: [string, string][] = [
  ['iso_9001', 'ISO 9001'], ['iso_13485', 'ISO 13485'], ['iso_22716', 'ISO 22716'],
  ['iso_14001', 'ISO 14001'], ['iso_45001', 'ISO 45001'], ['rohs', 'RoHS'], ['reach', 'REACH'],
  ['ce', 'CE'], ['fda', 'FDA'], ['ul', 'UL'], ['iec', 'IEC'], ['cb_report', 'CB Report'],
];

export default function PlmHerstellerKarte() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { roles } = useAuth();
  const canWrite = (roles || []).some((r: string) => WRITE_ROLES.includes(r));
  const canDelete = (roles || []).includes('Super Admin');

  const [mfr, setMfr] = useState<any | null>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [parts, setParts] = useState<any[]>([]);
  const [usage, setUsage] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [docOpen, setDocOpen] = useState(false);
  const [docForm, setDocForm] = useState<any>({});
  const [supOpen, setSupOpen] = useState(false);
  const [supForm, setSupForm] = useState<any>({ currency: 'EUR' });

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [m, d, l, s, p] = await Promise.all([
      (supabase.from('plm_manufacturers' as any) as any).select('*').eq('id', id).maybeSingle(),
      (supabase.from('plm_manufacturer_documents' as any) as any).select('*').eq('manufacturer_id', id).order('created_at', { ascending: false }),
      (supabase.from('plm_manufacturer_suppliers' as any) as any).select('*').eq('manufacturer_id', id),
      (supabase.from('plm_suppliers' as any) as any).select('id,name,supplier_number').order('name'),
      (supabase.from('plm_parts' as any) as any).select('id,part_number,name,manufacturer_part_number,original_part_number,release_status,device_id,assembly_id').eq('manufacturer_id', id).limit(1000),
    ]);
    setMfr(m.data || null);
    setDocs(d.data || []);
    setLinks(l.data || []);
    setSuppliers(s.data || []);
    const partRows = (p.data as any[]) || [];
    setParts(partRows);

    if (partRows.length) {
      const ids = partRows.map(r => r.id);
      const [bom, devices] = await Promise.all([
        (supabase.from('plm_bom_items' as any) as any).select('id,part_id,device_id,assembly_id,position_no,quantity,unit').in('part_id', ids).limit(2000),
        (supabase.from('plm_devices' as any) as any).select('id,name,article_number').limit(1000),
      ]);
      const devMap = new Map((devices.data as any[] || []).map(x => [x.id, x]));
      setUsage(((bom.data as any[]) || []).map(b => ({
        ...b,
        part: partRows.find(x => x.id === b.part_id),
        device: devMap.get(b.device_id),
      })));
    } else setUsage([]);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const supplierName = (sid: string) => suppliers.find(s => s.id === sid)?.name || '—';

  async function saveDoc() {
    if (!docForm.title) return toast.error('Titel erforderlich');
    const payload = { ...docForm, manufacturer_id: id };
    const res = docForm.id
      ? await (supabase.from('plm_manufacturer_documents' as any) as any).update(payload).eq('id', docForm.id)
      : await (supabase.from('plm_manufacturer_documents' as any) as any).insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success('Dokument gespeichert');
    setDocOpen(false); setDocForm({}); load();
  }

  async function delDoc(row: any) {
    if (!confirm('Dokument löschen?')) return;
    const { error } = await (supabase.from('plm_manufacturer_documents' as any) as any).delete().eq('id', row.id);
    if (error) return toast.error(error.message);
    load();
  }

  async function saveSupplier() {
    if (!supForm.supplier_id) return toast.error('Lieferant wählen');
    const payload = {
      ...supForm, manufacturer_id: id,
      lead_time_days: supForm.lead_time_days ? Number(supForm.lead_time_days) : null,
      moq: supForm.moq ? Number(supForm.moq) : null,
      price: supForm.price ? Number(supForm.price) : null,
      rating: supForm.rating ? Number(supForm.rating) : null,
      response_time_hours: supForm.response_time_hours ? Number(supForm.response_time_hours) : null,
    };
    const res = supForm.id
      ? await (supabase.from('plm_manufacturer_suppliers' as any) as any).update(payload).eq('id', supForm.id)
      : await (supabase.from('plm_manufacturer_suppliers' as any) as any).insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success('Lieferant verknüpft');
    setSupOpen(false); setSupForm({ currency: 'EUR' }); load();
  }

  async function delSupplier(row: any) {
    if (!confirm('Verknüpfung löschen?')) return;
    const { error } = await (supabase.from('plm_manufacturer_suppliers' as any) as any).delete().eq('id', row.id);
    if (error) return toast.error(error.message);
    load();
  }

  const activeCerts = useMemo(() => CERTS.filter(([k]) => mfr?.[k]), [mfr]);

  if (loading) return <div className="p-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!mfr) return <div className="container py-10">Hersteller nicht gefunden.</div>;

  return (
    <div className="container max-w-[1600px] py-6 space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/produktion/hersteller')}>
        <ArrowLeft className="w-4 h-4 mr-1" /> Zurück zur Herstellerliste
      </Button>

      <PageHeader icon={Building2} title={mfr.name} subtitle={[mfr.manufacturer_code, mfr.country].filter(Boolean).join(' · ')} noBreadcrumbs />

      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-4">
          <PlmThumb value={mfr.logo_url} />
          <div className="text-sm">
            <p className="font-semibold">{mfr.short_name || mfr.name}</p>
            <p className="text-muted-foreground">{[mfr.street, mfr.zip, mfr.city, mfr.country].filter(Boolean).join(', ') || '—'}</p>
            <p className="text-muted-foreground">{[mfr.contact_name, mfr.contact_position, mfr.email, mfr.phone].filter(Boolean).join(' · ') || '—'}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {statusBadge(mfr.approval_status)}
            {mfr.is_critical && <Badge variant="outline" className="border-destructive/50 text-destructive">Kritisch</Badge>}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="qm">
        <TabsList>
          <TabsTrigger value="qm">Qualität & Audit</TabsTrigger>
          <TabsTrigger value="docs">Dokumente ({docs.length})</TabsTrigger>
          <TabsTrigger value="sup">Lieferanten ({links.length})</TabsTrigger>
          <TabsTrigger value="parts">Bauteile ({parts.length})</TabsTrigger>
          <TabsTrigger value="usage">Verwendung ({usage.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="qm" className="pt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Zertifikate</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {activeCerts.length ? activeCerts.map(([k, l]) => (
                <Badge key={k} variant="outline" className="border-emerald-500/40 text-emerald-500">{l}</Badge>
              )) : <span className="text-sm text-muted-foreground">Keine Zertifikate hinterlegt</span>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Audit</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-4 text-sm">
              <div><p className="text-muted-foreground text-xs">Auditstatus</p>{statusBadge(mfr.audit_status)}</div>
              <div><p className="text-muted-foreground text-xs">Auditdatum</p>{mfr.audit_date || '—'}</div>
              <div><p className="text-muted-foreground text-xs">Nächstes Audit</p>{mfr.next_audit_date || '—'}</div>
              <div><p className="text-muted-foreground text-xs">Zertifikate gültig bis</p>{mfr.cert_valid_until || '—'}</div>
            </CardContent>
          </Card>
          {mfr.notes && <Card><CardContent className="p-4 text-sm whitespace-pre-wrap">{mfr.notes}</CardContent></Card>}
        </TabsContent>

        <TabsContent value="docs" className="pt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Dokumentenverwaltung</CardTitle>
              {canWrite && <Button size="sm" onClick={() => { setDocForm({ release_status: 'entwurf' }); setDocOpen(true); }}><Plus className="w-4 h-4 mr-1" />Dokument</Button>}
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Titel</TableHead><TableHead>Art</TableHead><TableHead>Version</TableHead>
                  <TableHead>Revision</TableHead><TableHead>Gültig bis</TableHead><TableHead>Status</TableHead>
                  <TableHead>Verantwortlich</TableHead><TableHead className="text-right">Aktion</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {docs.map(d => (
                    <TableRow key={d.id} className="text-sm">
                      <TableCell>{d.title}</TableCell>
                      <TableCell>{plmLabel(d.doc_type)}</TableCell>
                      <TableCell>{d.version || '—'}</TableCell>
                      <TableCell>{d.revision || '—'}</TableCell>
                      <TableCell>{d.valid_until || '—'}</TableCell>
                      <TableCell>{statusBadge(d.release_status)}</TableCell>
                      <TableCell>{d.responsible || '—'}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {canWrite && <Button size="sm" variant="ghost" onClick={() => { setDocForm(d); setDocOpen(true); }}>Bearbeiten</Button>}
                        {canDelete && <Button size="icon" variant="ghost" onClick={() => delDoc(d)}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!docs.length && <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">Keine Dokumente</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sup" className="pt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Lieferanten dieses Herstellers</CardTitle>
              {canWrite && <Button size="sm" onClick={() => { setSupForm({ currency: 'EUR' }); setSupOpen(true); }}><Plus className="w-4 h-4 mr-1" />Lieferant</Button>}
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Lieferant</TableHead><TableHead>Lieferzeit</TableHead><TableHead>MOQ</TableHead>
                  <TableHead>Preis</TableHead><TableHead>Incoterms</TableHead><TableHead>Bewertung</TableHead>
                  <TableHead>Reaktionszeit</TableHead><TableHead className="text-right">Aktion</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {links.map(l => (
                    <TableRow key={l.id} className="text-sm">
                      <TableCell>{supplierName(l.supplier_id)}{l.is_preferred && <Badge variant="outline" className="ml-2 border-primary/40 text-primary">Vorzug</Badge>}</TableCell>
                      <TableCell>{l.lead_time_days ? `${l.lead_time_days} Tage` : '—'}</TableCell>
                      <TableCell>{l.moq ?? '—'}</TableCell>
                      <TableCell>{l.price != null ? `${l.price} ${l.currency || ''}` : '—'}</TableCell>
                      <TableCell>{l.incoterms || '—'}</TableCell>
                      <TableCell>{l.rating ?? '—'}</TableCell>
                      <TableCell>{l.response_time_hours ? `${l.response_time_hours} h` : '—'}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {canWrite && <Button size="sm" variant="ghost" onClick={() => { setSupForm(l); setSupOpen(true); }}>Bearbeiten</Button>}
                        {canDelete && <Button size="icon" variant="ghost" onClick={() => delSupplier(l)}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!links.length && <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">Keine Lieferanten verknüpft</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="parts" className="pt-4">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Teilenummer</TableHead><TableHead>Bezeichnung</TableHead>
                  <TableHead>Hersteller-Nr.</TableHead><TableHead>Original-Nr.</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {parts.map(p => (
                    <TableRow key={p.id} className="text-sm">
                      <TableCell className="font-mono text-xs">{p.part_number || '—'}</TableCell>
                      <TableCell>{p.name}</TableCell>
                      <TableCell className="font-mono text-xs">{p.manufacturer_part_number || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{p.original_part_number || '—'}</TableCell>
                      <TableCell>{statusBadge(p.release_status)}</TableCell>
                    </TableRow>
                  ))}
                  {!parts.length && <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">Keine Bauteile zugeordnet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage" className="pt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Wo werden die Teile verwendet?</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Gerät</TableHead><TableHead>Gerätenummer</TableHead><TableHead>BOM-Position</TableHead>
                  <TableHead>Bauteil</TableHead><TableHead>Menge / Gerät</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {usage.map(u => (
                    <TableRow key={u.id} className="text-sm">
                      <TableCell>{u.device?.name || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{u.device?.article_number || '—'}</TableCell>
                      <TableCell>{u.position_no ?? '—'}</TableCell>
                      <TableCell>{u.part?.name || '—'}</TableCell>
                      <TableCell>{[u.quantity, u.unit].filter(Boolean).join(' ') || '—'}</TableCell>
                    </TableRow>
                  ))}
                  {!usage.length && <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">Keine Stücklisten-Verwendung gefunden</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={docOpen} onOpenChange={setDocOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Dokument</DialogTitle></DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2"><Label className="text-xs">Titel</Label>
              <Input value={docForm.title || ''} onChange={e => setDocForm((s: any) => ({ ...s, title: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Dokumentart</Label>
              <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={docForm.doc_type || ''} onChange={e => setDocForm((s: any) => ({ ...s, doc_type: e.target.value }))}>
                <option value="">—</option>{MFR_DOC_TYPES.map(t => <option key={t} value={t}>{plmLabel(t)}</option>)}
              </select></div>
            <div className="space-y-1"><Label className="text-xs">Dok.-Nr.</Label>
              <Input value={docForm.document_number || ''} onChange={e => setDocForm((s: any) => ({ ...s, document_number: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Version</Label>
              <Input value={docForm.version || ''} onChange={e => setDocForm((s: any) => ({ ...s, version: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Revision</Label>
              <Input value={docForm.revision || ''} onChange={e => setDocForm((s: any) => ({ ...s, revision: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Gültig bis</Label>
              <Input type="date" value={docForm.valid_until || ''} onChange={e => setDocForm((s: any) => ({ ...s, valid_until: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Freigabestatus</Label>
              <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={docForm.release_status || 'entwurf'} onChange={e => setDocForm((s: any) => ({ ...s, release_status: e.target.value }))}>
                {MFR_DOC_STATUS.map(t => <option key={t} value={t}>{plmLabel(t)}</option>)}
              </select></div>
            <div className="space-y-1"><Label className="text-xs">Verantwortlicher</Label>
              <Input value={docForm.responsible || ''} onChange={e => setDocForm((s: any) => ({ ...s, responsible: e.target.value }))} /></div>
            <div className="space-y-1 md:col-span-2"><Label className="text-xs">Datei</Label>
              <PlmFileInput image={false} folder="hersteller" value={docForm.file_url} onChange={v => setDocForm((s: any) => ({ ...s, file_url: v }))} /></div>
            <div className="space-y-1 md:col-span-2"><Label className="text-xs">Notizen</Label>
              <Textarea rows={3} value={docForm.notes || ''} onChange={e => setDocForm((s: any) => ({ ...s, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDocOpen(false)}>Abbrechen</Button><Button onClick={saveDoc}>Speichern</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={supOpen} onOpenChange={setSupOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Lieferant verknüpfen</DialogTitle></DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2"><Label className="text-xs">Lieferant</Label>
              <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={supForm.supplier_id || ''} onChange={e => setSupForm((s: any) => ({ ...s, supplier_id: e.target.value }))}>
                <option value="">—</option>{suppliers.map(s => <option key={s.id} value={s.id}>{[s.supplier_number, s.name].filter(Boolean).join(' · ')}</option>)}
              </select></div>
            <div className="space-y-1"><Label className="text-xs">Lieferzeit (Tage)</Label>
              <Input type="number" value={supForm.lead_time_days ?? ''} onChange={e => setSupForm((s: any) => ({ ...s, lead_time_days: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">MOQ</Label>
              <Input type="number" value={supForm.moq ?? ''} onChange={e => setSupForm((s: any) => ({ ...s, moq: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Preis</Label>
              <Input type="number" value={supForm.price ?? ''} onChange={e => setSupForm((s: any) => ({ ...s, price: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Währung</Label>
              <Input value={supForm.currency || 'EUR'} onChange={e => setSupForm((s: any) => ({ ...s, currency: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Incoterms</Label>
              <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={supForm.incoterms || ''} onChange={e => setSupForm((s: any) => ({ ...s, incoterms: e.target.value }))}>
                <option value="">—</option>{INCOTERMS.map(t => <option key={t} value={t}>{t}</option>)}
              </select></div>
            <div className="space-y-1"><Label className="text-xs">Bewertung (1-5)</Label>
              <Input type="number" value={supForm.rating ?? ''} onChange={e => setSupForm((s: any) => ({ ...s, rating: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Reaktionszeit (h)</Label>
              <Input type="number" value={supForm.response_time_hours ?? ''} onChange={e => setSupForm((s: any) => ({ ...s, response_time_hours: e.target.value }))} /></div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!supForm.is_preferred} onChange={e => setSupForm((s: any) => ({ ...s, is_preferred: e.target.checked }))} />
              Vorzugslieferant
            </label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setSupOpen(false)}>Abbrechen</Button><Button onClick={saveSupplier}>Speichern</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
