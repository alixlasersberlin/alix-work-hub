import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { PageHeader } from '@/components/infinity/PageHeader';
import { FileText, Loader2, Save, Search, UserPlus, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { loadPdfOrderImportConfig, DEFAULT_PDF_IMPORT_CONFIG, type PdfOrderImportConfig } from '@/lib/pdf-order-import-config';

// ---------- Helpers ----------
function extractValue(v: any): any {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && 'value' in v) return v.value ?? '';
  return v;
}
function extractConf(v: any): number | null {
  if (v && typeof v === 'object' && typeof v.confidence === 'number') return v.confidence;
  return null;
}
function ConfPill({ c, green, yellow }: { c: number | null; green: number; yellow: number }) {
  if (c == null) return <span className="inline-block w-2 h-2 rounded-full bg-slate-500" />;
  const cls = c >= green ? 'bg-emerald-500' : c >= yellow ? 'bg-amber-400' : 'bg-red-500';
  return <span className={`inline-block w-2 h-2 rounded-full ${cls}`} title={`${Math.round(c)} %`} />;
}

type Draft = {
  order: Record<string, string>;
  customer: Record<string, string>;
  financials: Record<string, string>;
  delivery: Record<string, string>;
  contract: Record<string, string>;
  sales: Record<string, string>;
  items: Array<{ position: number; product_name: string; sku: string; quantity: string; unit_price: string; total_price: string; tax_rate: string }>;
};

const ORDER_FIELDS: Array<[string, string]> = [
  ['external_order_number', 'Externe Auftrags-Nr.'],
  ['offer_number', 'Angebots-Nr.'],
  ['contract_number', 'Vertrags-Nr.'],
  ['order_date', 'Auftragsdatum'],
  ['delivery_date_planned', 'Lieferdatum (geplant)'],
  ['currency', 'Währung'],
  ['sales_channel', 'Vertriebskanal'],
  ['branch', 'Niederlassung'],
];
const CUST_FIELDS: Array<[string, string]> = [
  ['company_name', 'Firma'],
  ['studio_name', 'Studio/Praxis'],
  ['contact_person', 'Ansprechpartner'],
  ['email', 'E-Mail'],
  ['phone', 'Telefon'],
  ['street', 'Straße'],
  ['house_number', 'Hausnr.'],
  ['postal_code', 'PLZ'],
  ['city', 'Ort'],
  ['country', 'Land'],
  ['vat_id', 'USt-ID'],
];
const FIN_FIELDS: Array<[string, string]> = [
  ['net_amount', 'Netto'],
  ['tax_amount', 'MwSt'],
  ['tax_rate', 'MwSt-Satz'],
  ['gross_amount', 'Brutto'],
  ['downpayment', 'Anzahlung'],
  ['remaining_amount', 'Restbetrag'],
  ['payment_method', 'Zahlungsart'],
  ['due_date', 'Fälligkeit'],
  ['financing_partner', 'Finanzierungspartner'],
];
const SALES_FIELDS: Array<[string, string]> = [
  ['salesperson', 'Verkäufer'],
  ['commission_rate', 'Provision %'],
];

export default function PdfOrderImportReview() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [imp, setImp] = useState<any>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confidences, setConfidences] = useState<Record<string, number | null>>({});
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerHits, setCustomerHits] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [createNewCustomer, setCreateNewCustomer] = useState(false);
  const [config, setConfig] = useState<PdfOrderImportConfig>(DEFAULT_PDF_IMPORT_CONFIG);
  const [followups, setFollowups] = useState({ ...DEFAULT_PDF_IMPORT_CONFIG.auto_followups_default });

  async function load() {
    if (!id) return;
    setLoading(true);
    const { data: row } = await supabase.from('pdf_order_imports').select('*').eq('id', id).maybeSingle();
    setImp(row);
    if (row?.source_storage_path) {
      const { data: signed } = await supabase.storage.from('order-imports').createSignedUrl(row.source_storage_path, 3600);
      setPdfUrl(signed?.signedUrl ?? null);
    }
    // Draft aus corrected_extraction_json ODER raw_extraction_json aufbauen
    const src = (row?.corrected_extraction_json as any) ?? (row?.raw_extraction_json as any) ?? {};
    const confMap: Record<string, number | null> = {};
    const mapSection = (sec: any, keys: string[]) => {
      const out: Record<string, string> = {};
      for (const k of keys) {
        const v = sec?.[k];
        out[k] = String(extractValue(v) ?? '');
        confMap[k] = extractConf(v);
      }
      return out;
    };
    const items = Array.isArray(src.items)
      ? src.items.map((it: any, idx: number) => ({
          position: it.position ?? idx + 1,
          product_name: String(extractValue(it.product_name) ?? ''),
          sku: String(extractValue(it.sku) ?? ''),
          quantity: String(extractValue(it.quantity) ?? ''),
          unit_price: String(extractValue(it.unit_price) ?? ''),
          total_price: String(extractValue(it.total_price) ?? ''),
          tax_rate: String(extractValue(it.tax_rate) ?? ''),
        }))
      : [];
    setDraft({
      order: mapSection(src.order, ORDER_FIELDS.map((f) => f[0])),
      customer: mapSection(src.customer, CUST_FIELDS.map((f) => f[0])),
      financials: mapSection(src.financials, FIN_FIELDS.map((f) => f[0])),
      delivery: mapSection(src.delivery, ['delivery_type', 'installation_required', 'training_required', 'nisv_training', 'mediapaket', 'warranty_period']),
      contract: mapSection(src.contract, ['runtime', 'cancellation_period']),
      sales: mapSection(src.sales, SALES_FIELDS.map((f) => f[0])),
      items,
    });
    setConfidences(confMap);
    setLoading(false);
  }

  useEffect(() => {
    document.title = 'PDF-Import prüfen · Alix Work';
    loadPdfOrderImportConfig().then((cfg) => {
      setConfig(cfg);
      setFollowups({ ...cfg.auto_followups_default });
    });
    load();
  }, [id]);

  // Standard-Währung aus Config als Fallback befüllen
  useEffect(() => {
    if (!draft) return;
    if (!draft.order.currency && config.default_currency) {
      setField('order', 'currency', config.default_currency);
    }
    if (!draft.order.branch && config.default_branch) {
      setField('order', 'branch', config.default_branch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft && !draft.order.currency, config.default_currency]);

  // Kundensuche mit Debounce
  useEffect(() => {
    if (!customerSearch || customerSearch.length < 2) { setCustomerHits([]); return; }
    const t = setTimeout(async () => {
      const q = customerSearch.trim();
      const { data } = await supabase
        .from('customers')
        .select('id, company_name, contact_name, email, phone, external_customer_id')
        .or(`company_name.ilike.%${q}%,contact_name.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(10);
      setCustomerHits(data ?? []);
    }, 300);
    return () => clearTimeout(t);
  }, [customerSearch]);

  // Auto-Suche mit erkanntem Firmennamen beim ersten Laden
  useEffect(() => {
    if (draft && !customerSearch && !selectedCustomer && !createNewCustomer) {
      const name = draft.customer.company_name || draft.customer.contact_person;
      if (name) setCustomerSearch(name);
    }
  }, [draft]);

  const totals = useMemo(() => {
    if (!draft) return { net: 0, gross: 0, ok: true };
    const gross = Number(draft.financials.gross_amount) || 0;
    const net = Number(draft.financials.net_amount) || 0;
    const tax = Number(draft.financials.tax_amount) || 0;
    const ok = Math.abs(net + tax - gross) < 0.5 || !gross || !net;
    return { net, gross, ok };
  }, [draft]);

  function setField(sec: keyof Draft, key: string, val: string) {
    setDraft((d) => {
      if (!d) return d;
      const s = { ...(d[sec] as any), [key]: val };
      return { ...d, [sec]: s } as Draft;
    });
  }
  function setItem(idx: number, key: string, val: string) {
    setDraft((d) => {
      if (!d) return d;
      const items = d.items.slice();
      items[idx] = { ...items[idx], [key]: val };
      return { ...d, items };
    });
  }
  function addItem() {
    setDraft((d) => d ? { ...d, items: [...d.items, { position: d.items.length + 1, product_name: '', sku: '', quantity: '1', unit_price: '0', total_price: '0', tax_rate: '19' }] } : d);
  }
  function removeItem(idx: number) {
    setDraft((d) => d ? { ...d, items: d.items.filter((_, i) => i !== idx) } : d);
  }

  async function saveDraft() {
    if (!draft || !id) return;
    setSaving(true);
    const { error } = await supabase
      .from('pdf_order_imports')
      .update({ corrected_extraction_json: buildCorrected(draft) as any, status: 'review' })
      .eq('id', id);
    setSaving(false);
    if (error) toast.error('Speichern fehlgeschlagen: ' + error.message);
    else toast.success('Entwurf gespeichert');
  }

  function buildCorrected(d: Draft) {
    const num = (s: string) => {
      if (!s) return null;
      const n = parseFloat(String(s).replace(/\./g, '').replace(',', '.'));
      return isFinite(n) ? n : null;
    };
    return {
      order: d.order,
      customer: d.customer,
      financials: Object.fromEntries(Object.entries(d.financials).map(([k, v]) => [k, ['payment_method', 'financing_partner', 'due_date'].includes(k) ? v : num(v) ?? v])),
      delivery: d.delivery,
      contract: d.contract,
      sales: d.sales,
      items: d.items.map((it, i) => ({
        position: it.position ?? i + 1,
        product_name: it.product_name || null,
        sku: it.sku || null,
        quantity: num(it.quantity),
        unit_price: num(it.unit_price),
        total_price: num(it.total_price),
        tax_rate: num(it.tax_rate),
      })),
    };
  }

  async function commit() {
    if (!draft || !id) return;
    if (!selectedCustomer && !createNewCustomer) {
      toast.error('Bitte Kunde auswählen oder „neu anlegen" markieren.');
      return;
    }
    if (draft.items.length === 0) {
      if (!confirm('Keine Positionen erfasst. Trotzdem Auftrag anlegen?')) return;
    }
    setSaving(true);
    const { data, error } = await supabase.functions.invoke('pdf-order-commit', {
      body: {
        import_id: id,
        corrected: buildCorrected(draft),
        customer_choice: selectedCustomer
          ? { mode: 'existing', id: selectedCustomer.id }
          : { mode: 'new' },
        auto_followups: followups,
      },
    });
    setSaving(false);
    if (error || (data as any)?.error) {
      toast.error('Import fehlgeschlagen: ' + (error?.message ?? (data as any)?.error));
      return;
    }
    toast.success(`Auftrag ${(data as any).order_number} angelegt.`);
    nav('/auftraege');
  }

  if (loading || !draft || !imp) {
    return <div className="p-8 flex items-center justify-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Lädt …</div>;
  }

  if (imp.status === 'committed') {
    return (
      <div className="space-y-4">
        <PageHeader icon={FileText} title="Bereits importiert" subtitle={imp.source_filename} />
        <Card className="border-emerald-500/40 bg-emerald-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <div className="flex-1 text-sm">Dieser Import wurde bereits in einen Auftrag überführt.</div>
            {imp.created_order_id && (
              <Button size="sm" onClick={() => nav(`/auftraege/${imp.created_order_id}`)}>Zum Auftrag</Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <PageHeader icon={FileText} title="PDF-Import prüfen" subtitle={imp.source_filename} />
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => nav(`/auftraege/pdf-import/${id}`)}>Detail-Ansicht</Button>
          <Button variant="outline" onClick={saveDraft} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Entwurf speichern
          </Button>
          <Button onClick={commit} disabled={saving} className="bg-amber-500 hover:bg-amber-600 text-black gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Auftrag anlegen
          </Button>
        </div>
      </div>

      {!totals.ok && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-3 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Netto + MwSt weichen von Brutto ab – bitte prüfen.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* Links: PDF */}
        <Card className="border-border/60 bg-card/40 backdrop-blur-xl lg:sticky lg:top-4 h-fit">
          <CardHeader><CardTitle className="text-sm">PDF-Vorschau</CardTitle></CardHeader>
          <CardContent>
            {pdfUrl ? (
              <iframe src={pdfUrl} className="w-full h-[calc(100vh-220px)] rounded border border-border" />
            ) : <div className="text-sm text-muted-foreground">Vorschau nicht verfügbar.</div>}
          </CardContent>
        </Card>

        {/* Rechts: Formular */}
        <div className="space-y-4">
          {/* Kunden-Matching */}
          <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
            <CardHeader><CardTitle className="text-sm">Kunde zuordnen</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {selectedCustomer ? (
                <div className="flex items-center justify-between rounded-md border border-emerald-500/40 bg-emerald-500/5 px-3 py-2 text-sm">
                  <div>
                    <div className="font-medium">{selectedCustomer.company_name || selectedCustomer.contact_name || '—'}</div>
                    <div className="text-xs text-muted-foreground">{selectedCustomer.external_customer_id ?? ''} · {selectedCustomer.email ?? ''}</div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedCustomer(null)}>Ändern</Button>
                </div>
              ) : createNewCustomer ? (
                <div className="flex items-center justify-between rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm">
                  <div className="flex items-center gap-2"><UserPlus className="w-4 h-4 text-amber-400" /> Neuer Kunde wird angelegt (aus PDF-Daten).</div>
                  <Button variant="ghost" size="sm" onClick={() => setCreateNewCustomer(false)}>Zurücksetzen</Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input className="pl-8" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} placeholder="Firma / Ansprechpartner / E-Mail suchen…" />
                  </div>
                  {customerHits.length > 0 && (
                    <div className="rounded border border-border max-h-64 overflow-auto">
                      {customerHits.map((h) => (
                        <button key={h.id} type="button" className="w-full text-left px-3 py-2 hover:bg-secondary/50 border-b border-border last:border-0" onClick={() => setSelectedCustomer(h)}>
                          <div className="text-sm font-medium">{h.company_name || h.contact_name || '—'}</div>
                          <div className="text-[11px] text-muted-foreground">{h.external_customer_id ? `#${h.external_customer_id} · ` : ''}{h.email ?? ''} · {h.phone ?? ''}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {customerSearch.length >= 2 && customerHits.length === 0 && (
                    <div className="text-xs text-muted-foreground">Keine Treffer. Du kannst den Kunden aus den PDF-Daten neu anlegen.</div>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setCreateNewCustomer(true)} className="gap-2">
                    <UserPlus className="w-4 h-4" /> Neuen Kunden aus PDF anlegen
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Auftragsdaten */}
          <Section title="Auftragsdaten" fields={ORDER_FIELDS} data={draft.order} conf={confidences} green={config.confidence_green} yellow={config.confidence_yellow} onChange={(k, v) => setField('order', k, v)} />

          {/* Kunde */}
          <Section title="Kundendaten" fields={CUST_FIELDS} data={draft.customer} conf={confidences} green={config.confidence_green} yellow={config.confidence_yellow} onChange={(k, v) => setField('customer', k, v)} />

          {/* Finanzen */}
          <Section title="Finanzen" fields={FIN_FIELDS} data={draft.financials} conf={confidences} green={config.confidence_green} yellow={config.confidence_yellow} onChange={(k, v) => setField('financials', k, v)} />

          {/* Sales */}
          <Section title="Vertrieb" fields={SALES_FIELDS} data={draft.sales} conf={confidences} green={config.confidence_green} yellow={config.confidence_yellow} onChange={(k, v) => setField('sales', k, v)} />

          {/* Positionen */}
          <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm">Positionen</CardTitle>
              <Button size="sm" variant="outline" onClick={addItem}>+ Position</Button>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-secondary/60 text-muted-foreground uppercase tracking-wide">
                  <tr>
                    <th className="p-2 text-left w-8">#</th>
                    <th className="p-2 text-left">Produkt</th>
                    <th className="p-2 text-left w-28">SKU</th>
                    <th className="p-2 text-right w-16">Menge</th>
                    <th className="p-2 text-right w-24">EP</th>
                    <th className="p-2 text-right w-24">Summe</th>
                    <th className="p-2 text-right w-16">MwSt %</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {draft.items.map((it, idx) => (
                    <tr key={idx} className="border-t border-border">
                      <td className="p-1 text-center text-muted-foreground">{it.position}</td>
                      <td className="p-1"><Input value={it.product_name} onChange={(e) => setItem(idx, 'product_name', e.target.value)} className="h-7 text-xs" /></td>
                      <td className="p-1"><Input value={it.sku} onChange={(e) => setItem(idx, 'sku', e.target.value)} className="h-7 text-xs" /></td>
                      <td className="p-1"><Input value={it.quantity} onChange={(e) => setItem(idx, 'quantity', e.target.value)} className="h-7 text-xs text-right" /></td>
                      <td className="p-1"><Input value={it.unit_price} onChange={(e) => setItem(idx, 'unit_price', e.target.value)} className="h-7 text-xs text-right" /></td>
                      <td className="p-1"><Input value={it.total_price} onChange={(e) => setItem(idx, 'total_price', e.target.value)} className="h-7 text-xs text-right" /></td>
                      <td className="p-1"><Input value={it.tax_rate} onChange={(e) => setItem(idx, 'tax_rate', e.target.value)} className="h-7 text-xs text-right" /></td>
                      <td className="p-1 text-center"><Button size="sm" variant="ghost" onClick={() => removeItem(idx)}>×</Button></td>
                    </tr>
                  ))}
                  {draft.items.length === 0 && (
                    <tr><td colSpan={8} className="p-3 text-center text-muted-foreground">Keine Positionen. „+ Position" nutzen.</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Folgeprozesse */}
          <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
            <CardHeader><CardTitle className="text-sm">Folgeprozesse beim Anlegen</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 text-sm">
              {([
                ['delivery_planning', 'Lieferplanung anstoßen'],
                ['mediapaket', 'Mediapaket anlegen'],
                ['nisv', 'NiSV-Schulung planen'],
                ['financing', 'Finanzierungs-Vorgang öffnen'],
                ['deposit_check', 'Anzahlungs-Prüfung aktivieren'],
              ] as const).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={(followups as any)[k]} onCheckedChange={(v) => setFollowups((f) => ({ ...f, [k]: !!v }))} />
                  <span>{label}</span>
                </label>
              ))}
              <p className="col-span-2 text-xs text-muted-foreground pt-2">
                Aktive Module werden automatisch mit den erkannten Werten befüllt. Deaktivierte werden übersprungen.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Section({ title, fields, data, conf, green, yellow, onChange }: {
  title: string;
  fields: Array<[string, string]>;
  data: Record<string, string>;
  conf: Record<string, number | null>;
  green: number;
  yellow: number;
  onChange: (key: string, val: string) => void;
}) {
  return (
    <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
      <CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        {fields.map(([k, label]) => (
          <div key={k} className="space-y-1">
            <Label className="text-xs flex items-center gap-1.5">
              <ConfPill c={conf[k] ?? null} green={green} yellow={yellow} /> {label}
            </Label>
            <Input value={data[k] ?? ''} onChange={(e) => onChange(k, e.target.value)} className="h-8 text-sm" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
