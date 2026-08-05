import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Loader2, Plus, Trash2, FileText, Search, Download } from 'lucide-react';
import { generateCmrDocumentPdf, cmrPdfFilename } from '@/lib/cmr-document-pdf';
import { toast } from 'sonner';
import { useCmrTenant, cmrMoney, CMR_DOC_TYPES, CMR_DOC_STATUS } from '@/hooks/useCmrTenant';

type Doc = {
  id: string; doc_type: string; doc_number: string | null; status: string;
  customer_id: string | null; customer_name: string | null; customer_email: string | null;
  doc_date: string; due_date: string | null; currency: string; tax_rate: number;
  net_total: number; tax_total: number; gross_total: number; paid_total: number;
  reference: string | null; notes: string | null;
};

type Line = {
  id?: string; item_id?: string | null; position: number; name: string; description?: string | null;
  quantity: number; unit: string; unit_price: number; discount_pct: number; tax_rate: number; line_total: number;
};

const newLine = (pos: number, tax: number): Line => ({
  position: pos, name: '', quantity: 1, unit: 'Stück', unit_price: 0, discount_pct: 0, tax_rate: tax, line_total: 0,
});

function lineTotal(l: Line) {
  return Number(l.quantity || 0) * Number(l.unit_price || 0) * (1 - Number(l.discount_pct || 0) / 100);
}

export default function CmrDokumente() {
  const { tenantId, settings, loading } = useCmrTenant();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [busy, setBusy] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Doc | null>(null);
  const [head, setHead] = useState<any>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [custQuery, setCustQuery] = useState('');
  const [custResults, setCustResults] = useState<any[]>([]);

  const cur = settings?.default_currency || 'AED';
  const defTax = Number(settings?.tax_rate ?? 5);

  const load = async () => {
    if (!tenantId) return;
    setBusy(true);
    const { data } = await supabase
      .from('cmr_documents' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .order('doc_date', { ascending: false })
      .limit(500);
    setDocs(((data as any) || []) as Doc[]);
    setBusy(false);
  };

  useEffect(() => { load(); }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    supabase.from('cmr_items' as any).select('id,name,price,unit,tax_rate').eq('tenant_id', tenantId).eq('is_active', true)
      .then(({ data }) => setItems((data as any) || []));
  }, [tenantId]);

  useEffect(() => {
    if (custQuery.trim().length < 2) { setCustResults([]); return; }
    const t = setTimeout(async () => {
      const q = custQuery.trim();
      const { data } = await supabase
        .from('customers')
        .select('id, company_name, contact_name, email')
        .or(`company_name.ilike.%${q}%,contact_name.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(10);
      setCustResults((data as any) || []);
    }, 300);
    return () => clearTimeout(t);
  }, [custQuery]);

  const startNew = () => {
    setEditing(null);
    setHead({
      doc_type: 'angebot', status: 'entwurf', customer_id: '', customer_name: '', customer_email: '',
      doc_date: new Date().toISOString().slice(0, 10), due_date: '', reference: '', notes: '',
      billing_address: '', tax_rate: defTax,
    });
    setLines([newLine(1, defTax)]);
    setCustQuery(''); setCustResults([]);
    setOpen(true);
  };

  const startEdit = async (d: Doc) => {
    setEditing(d);
    setHead({
      doc_type: d.doc_type, status: d.status, customer_id: d.customer_id ?? '', customer_name: d.customer_name ?? '',
      customer_email: d.customer_email ?? '', doc_date: d.doc_date, due_date: d.due_date ?? '',
      reference: d.reference ?? '', notes: d.notes ?? '', tax_rate: d.tax_rate,
    });
    const { data } = await supabase.from('cmr_document_items' as any).select('*').eq('document_id', d.id).order('position');
    setLines((((data as any) || []) as Line[]).map((l) => ({ ...l })));
    setOpen(true);
  };

  const totals = useMemo(() => {
    const net = lines.reduce((s, l) => s + lineTotal(l), 0);
    const tax = lines.reduce((s, l) => s + lineTotal(l) * (Number(l.tax_rate || 0) / 100), 0);
    return { net, tax, gross: net + tax };
  }, [lines]);

  const save = async () => {
    if (!tenantId) return;
    if (!head.customer_name && !head.customer_id) { toast.error('Bitte einen Kunden wählen oder erfassen.'); return; }
    setSaving(true);
    try {
      let docId = editing?.id ?? null;
      let docNumber = editing?.doc_number ?? null;

      if (!docId) {
        const { data: nr, error: nrErr } = await supabase.rpc('cmr_next_document_number' as any, {
          _tenant_id: tenantId, _doc_type: head.doc_type,
        } as any);
        if (nrErr) throw nrErr;
        docNumber = nr as any;
      }

      const payload: any = {
        tenant_id: tenantId,
        doc_type: head.doc_type,
        doc_number: docNumber,
        status: head.status,
        customer_id: head.customer_id || null,
        customer_name: head.customer_name || null,
        customer_email: head.customer_email || null,
        doc_date: head.doc_date,
        due_date: head.due_date || null,
        currency: cur,
        tax_rate: Number(head.tax_rate) || 0,
        net_total: totals.net,
        tax_total: totals.tax,
        gross_total: totals.gross,
        reference: head.reference || null,
        notes: head.notes || null,
      };

      if (docId) {
        const { error } = await supabase.from('cmr_documents' as any).update(payload).eq('id', docId);
        if (error) throw error;
        await supabase.from('cmr_document_items' as any).delete().eq('document_id', docId);
      } else {
        const { data, error } = await supabase.from('cmr_documents' as any).insert(payload).select('id').single();
        if (error) throw error;
        docId = (data as any).id;
      }

      const rows = lines.filter((l) => l.name.trim()).map((l, idx) => ({
        document_id: docId,
        item_id: l.item_id || null,
        position: idx + 1,
        name: l.name,
        description: l.description || null,
        quantity: Number(l.quantity) || 0,
        unit: l.unit || 'Stück',
        unit_price: Number(l.unit_price) || 0,
        discount_pct: Number(l.discount_pct) || 0,
        tax_rate: Number(l.tax_rate) || 0,
        line_total: lineTotal(l),
      }));
      if (rows.length) {
        const { error } = await supabase.from('cmr_document_items' as any).insert(rows);
        if (error) throw error;
      }

      toast.success(editing ? 'Dokument aktualisiert' : `Dokument ${docNumber} angelegt`);
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message ?? 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  const downloadPdf = async (d: Doc) => {
    try {
      const { data } = await supabase.from('cmr_document_items' as any).select('*').eq('document_id', d.id).order('position');
      const pdf = generateCmrDocumentPdf(d as any, ((data as any) || []) as any, settings);
      pdf.save(cmrPdfFilename(d as any));
    } catch (e: any) {
      toast.error(e.message ?? 'PDF konnte nicht erstellt werden');
    }
  };

  const filtered = docs.filter((d) =>

    (!typeFilter || d.doc_type === typeFilter) &&
    (!search || `${d.doc_number ?? ''} ${d.customer_name ?? ''} ${d.reference ?? ''}`.toLowerCase().includes(search.toLowerCase())));

  if (loading || busy) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <PageHeader title="CMR Geschäftsvorgänge" subtitle="Angebote, Aufträge, Rechnungen und mehr – ausschließlich im Mandanten CMR sichtbar." />

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-3 text-muted-foreground" />
          <Input className="pl-8 max-w-xs" placeholder="Nummer, Kunde, Referenz…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">Alle Belegarten</option>
          {CMR_DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <Button className="ml-auto" onClick={startNew}><Plus className="w-4 h-4 mr-1.5" /> Neuer Beleg</Button>
      </div>

      <Card className="divide-y">
        {filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <FileText className="w-5 h-5" /> Noch keine Belege vorhanden.
          </div>
        )}
        {filtered.map((d) => (
          <div key={d.id} className="w-full p-3 hover:bg-muted/50 flex items-center gap-3">
            <button className="min-w-0 flex-1 text-left" onClick={() => startEdit(d)}>
              <div className="font-medium truncate">
                {d.doc_number ?? '—'} · {CMR_DOC_TYPES.find((t) => t.value === d.doc_type)?.label ?? d.doc_type}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {d.customer_name ?? 'Ohne Kunde'} · {new Date(d.doc_date).toLocaleDateString('de-DE')}
              </div>
            </button>
            <Badge variant="outline" className="capitalize">{d.status}</Badge>
            <div className="text-sm font-semibold whitespace-nowrap">{cmrMoney(d.gross_total, d.currency || cur)}</div>
            <Button size="icon" variant="ghost" title="PDF herunterladen" onClick={() => downloadPdf(d)}>
              <Download className="w-4 h-4" />
            </Button>
          </div>

        ))}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Beleg ${editing.doc_number ?? ''} bearbeiten` : 'Neuer Beleg'}</DialogTitle>
          </DialogHeader>

          {head && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label>Belegart</Label>
                  <select
                    className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={head.doc_type} disabled={!!editing}
                    onChange={(e) => setHead({ ...head, doc_type: e.target.value })}
                  >
                    {CMR_DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Status</Label>
                  <select
                    className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={head.status} onChange={(e) => setHead({ ...head, status: e.target.value })}
                  >
                    {CMR_DOC_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div><Label>Belegdatum</Label><Input type="date" value={head.doc_date} onChange={(e) => setHead({ ...head, doc_date: e.target.value })} /></div>
                <div><Label>Fällig am</Label><Input type="date" value={head.due_date} onChange={(e) => setHead({ ...head, due_date: e.target.value })} /></div>
              </div>

              <div className="space-y-2">
                <Label>Kunde (gemeinsamer Kundenstamm)</Label>
                <Input placeholder="Kunde suchen…" value={custQuery} onChange={(e) => setCustQuery(e.target.value)} />
                {custResults.length > 0 && (
                  <Card className="divide-y max-h-44 overflow-y-auto">
                    {custResults.map((c) => (
                      <button
                        key={c.id} className="w-full text-left p-2 text-sm hover:bg-muted/50"
                        onClick={() => {
                          setHead({
                            ...head, customer_id: c.id,
                            customer_name: c.company_name || c.contact_name || '',
                            customer_email: c.email || '',
                          });
                          setCustQuery(''); setCustResults([]);
                        }}
                      >
                        {c.company_name || c.contact_name} <span className="text-muted-foreground">{c.email}</span>
                      </button>
                    ))}
                  </Card>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Kundenname</Label><Input value={head.customer_name} onChange={(e) => setHead({ ...head, customer_name: e.target.value, customer_id: '' })} /></div>
                  <div><Label>E-Mail</Label><Input value={head.customer_email} onChange={(e) => setHead({ ...head, customer_email: e.target.value })} /></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="mb-0">Positionen</Label>
                  <div className="flex gap-2">
                    <select
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                      value=""
                      onChange={(e) => {
                        const it = items.find((i) => i.id === e.target.value);
                        if (!it) return;
                        setLines([...lines, {
                          ...newLine(lines.length + 1, Number(it.tax_rate ?? defTax)),
                          item_id: it.id, name: it.name, unit: it.unit || 'Stück', unit_price: Number(it.price || 0),
                        }]);
                      }}
                    >
                      <option value="">Artikel übernehmen…</option>
                      {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                    <Button size="sm" variant="outline" onClick={() => setLines([...lines, newLine(lines.length + 1, defTax)])}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> Position
                    </Button>
                  </div>
                </div>

                {lines.map((l, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <Input className="col-span-4" placeholder="Bezeichnung" value={l.name}
                      onChange={(e) => setLines(lines.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))} />
                    <Input className="col-span-1" type="number" step="0.01" value={l.quantity}
                      onChange={(e) => setLines(lines.map((x, i) => i === idx ? { ...x, quantity: Number(e.target.value) } : x))} />
                    <Input className="col-span-1" placeholder="Einh." value={l.unit}
                      onChange={(e) => setLines(lines.map((x, i) => i === idx ? { ...x, unit: e.target.value } : x))} />
                    <Input className="col-span-2" type="number" step="0.01" placeholder="Preis" value={l.unit_price}
                      onChange={(e) => setLines(lines.map((x, i) => i === idx ? { ...x, unit_price: Number(e.target.value) } : x))} />
                    <Input className="col-span-1" type="number" step="0.1" placeholder="% Rab." value={l.discount_pct}
                      onChange={(e) => setLines(lines.map((x, i) => i === idx ? { ...x, discount_pct: Number(e.target.value) } : x))} />
                    <Input className="col-span-1" type="number" step="0.1" placeholder="MwSt" value={l.tax_rate}
                      onChange={(e) => setLines(lines.map((x, i) => i === idx ? { ...x, tax_rate: Number(e.target.value) } : x))} />
                    <div className="col-span-1 text-right text-sm">{cmrMoney(lineTotal(l), cur)}</div>
                    <Button className="col-span-1" size="icon" variant="ghost" onClick={() => setLines(lines.filter((_, i) => i !== idx))}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><Label>Referenz</Label><Input value={head.reference} onChange={(e) => setHead({ ...head, reference: e.target.value })} /></div>
                <div className="text-right text-sm space-y-1 pt-6">
                  <div>Netto: <strong>{cmrMoney(totals.net, cur)}</strong></div>
                  <div>MwSt.: <strong>{cmrMoney(totals.tax, cur)}</strong></div>
                  <div className="text-base">Gesamt: <strong>{cmrMoney(totals.gross, cur)}</strong></div>
                </div>
              </div>

              <div><Label>Notizen (auf Beleg)</Label><Textarea rows={2} value={head.notes} onChange={(e) => setHead({ ...head, notes: e.target.value })} /></div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />} Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
