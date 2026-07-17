import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/infinity/PageHeader';
import { FileText, Loader2, RefreshCcw, ExternalLink, Download, AlertTriangle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function conf(v: any): number | null {
  if (!v || typeof v !== 'object') return null;
  return typeof v.confidence === 'number' ? v.confidence : null;
}
function val(v: any): string {
  if (v === null || v === undefined) return '—';
  if (typeof v !== 'object') return String(v);
  if ('value' in v) return v.value == null ? '—' : String(v.value);
  return JSON.stringify(v);
}
function ConfPill({ c }: { c: number | null }) {
  if (c == null) return <span className="inline-block w-2 h-2 rounded-full bg-slate-500" />;
  const cls = c >= 90 ? 'bg-emerald-500' : c >= 70 ? 'bg-amber-400' : 'bg-red-500';
  return <span className={`inline-block w-2 h-2 rounded-full ${cls}`} title={`${Math.round(c)} %`} />;
}
function Field({ label, v }: { label: string; v: any }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground w-40 flex-shrink-0">{label}</span>
      <span className="text-sm truncate flex-1">{val(v)}</span>
      <ConfPill c={conf(v)} />
    </div>
  );
}

export default function PdfOrderImportDetail() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [imp, setImp] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [rerunning, setRerunning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { hasRole } = useAuth();
  const canDelete = hasRole('Super Admin');

  async function load() {
    if (!id) return;
    setLoading(true);
    const { data: impRow } = await supabase.from('pdf_order_imports').select('*').eq('id', id).maybeSingle();
    setImp(impRow);
    const { data: itemRows } = await supabase.from('pdf_order_import_items').select('*').eq('order_import_id', id).order('position');
    setItems(itemRows ?? []);
    if (impRow?.source_storage_path) {
      const { data: signed } = await supabase.storage.from('order-imports').createSignedUrl(impRow.source_storage_path, 3600);
      setPdfUrl(signed?.signedUrl ?? null);
    }
    setLoading(false);
  }

  useEffect(() => { document.title = 'PDF-Import · Alix Work'; load(); }, [id]);

  // Poll solange analyzing
  useEffect(() => {
    if (imp?.status === 'analyzing' || imp?.status === 'uploaded') {
      const t = setInterval(load, 3000);
      return () => clearInterval(t);
    }
  }, [imp?.status]);

  async function rerun() {
    if (!id) return;
    setRerunning(true);
    const { error } = await supabase.functions.invoke('pdf-order-analyze', { body: { import_id: id } });
    setRerunning(false);
    if (error) toast.error(error.message); else { toast.success('Analyse gestartet'); load(); }
  }

  const raw = imp?.raw_extraction_json ?? {};
  const order = raw.order ?? {};
  const customer = raw.customer ?? {};
  const financials = raw.financials ?? {};
  const delivery = raw.delivery ?? {};
  const contract = raw.contract ?? {};
  const sales = raw.sales ?? {};
  const signatures = raw.signatures ?? {};
  const warnings: string[] = imp?.warnings_json ?? [];

  const busy = imp?.status === 'analyzing' || imp?.status === 'uploaded';

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          icon={FileText}
          title={imp?.source_filename ?? 'PDF-Import'}
          subtitle={imp ? `Status: ${imp.status} · Konfidenz: ${imp.overall_confidence != null ? Math.round(imp.overall_confidence) + ' %' : '—'}` : '…'}
        />
        <div className="flex items-center gap-2">
          {pdfUrl && (
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="gap-2"><Download className="w-4 h-4" /> Original-PDF</Button>
            </a>
          )}
          <Button variant="outline" onClick={rerun} disabled={rerunning || busy} className="gap-2">
            {rerunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />} Erneut analysieren
          </Button>
          <Button variant="outline" onClick={() => nav('/auftraege/pdf-import')}>Zurück zur Liste</Button>
        </div>
      </div>

      {loading && <div className="p-8 flex items-center justify-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Lädt …</div>}

      {imp?.status === 'failed' && (
        <Card className="border-red-500/40 bg-red-500/5"><CardContent className="p-4 text-sm">Fehler: {imp.error_message ?? 'unbekannt'}</CardContent></Card>
      )}
      {busy && (
        <Card className="border-blue-500/40 bg-blue-500/5">
          <CardContent className="p-4 text-sm flex items-center gap-3">
            <Loader2 className="w-4 h-4 animate-spin" /> KI-Analyse läuft … (Diese Seite aktualisiert sich automatisch.)
          </CardContent>
        </Card>
      )}
      {imp?.status === 'duplicate' && (
        <Card className="border-orange-500/40 bg-orange-500/5">
          <CardContent className="p-4 text-sm flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-orange-400" /> Duplikatverdacht – die gleiche Datei wurde bereits einmal hochgeladen.
          </CardContent>
        </Card>
      )}
      {warnings.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-4 text-sm">
            <div className="font-medium mb-1 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Warnungen</div>
            <ul className="list-disc pl-5 space-y-0.5">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
          </CardContent>
        </Card>
      )}

      {imp && (imp.status === 'analyzed' || imp.status === 'review' || imp.status === 'duplicate') && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
            <CardHeader><CardTitle className="text-sm">PDF-Vorschau</CardTitle></CardHeader>
            <CardContent>
              {pdfUrl ? (
                <iframe src={pdfUrl} className="w-full h-[720px] rounded border border-border" />
              ) : (
                <div className="text-sm text-muted-foreground">Vorschau nicht verfügbar.</div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
              <CardHeader><CardTitle className="text-sm">Auftragsdaten</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                <Field label="Externe Auftrags-Nr." v={order.external_order_number} />
                <Field label="Angebots-Nr." v={order.offer_number} />
                <Field label="Vertrags-Nr." v={order.contract_number} />
                <Field label="Auftragsdatum" v={order.order_date} />
                <Field label="Lieferdatum" v={order.delivery_date_planned} />
                <Field label="Währung" v={order.currency} />
                <Field label="Vertriebskanal" v={order.sales_channel} />
                <Field label="Niederlassung" v={order.branch} />
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
              <CardHeader><CardTitle className="text-sm">Kunde</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                <Field label="Firma" v={customer.company_name} />
                <Field label="Studio/Praxis" v={customer.studio_name} />
                <Field label="Ansprechpartner" v={customer.contact_person} />
                <Field label="E-Mail" v={customer.email} />
                <Field label="Telefon" v={customer.phone} />
                <Field label="Straße" v={customer.street} />
                <Field label="PLZ" v={customer.postal_code} />
                <Field label="Ort" v={customer.city} />
                <Field label="Land" v={customer.country} />
                <Field label="USt-ID" v={customer.vat_id} />
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
              <CardHeader><CardTitle className="text-sm">Finanzen</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                <Field label="Netto" v={financials.net_amount} />
                <Field label="MwSt" v={financials.tax_amount} />
                <Field label="Brutto" v={financials.gross_amount} />
                <Field label="Anzahlung" v={financials.downpayment} />
                <Field label="Restbetrag" v={financials.remaining_amount} />
                <Field label="Zahlungsart" v={financials.payment_method} />
                <Field label="Fälligkeit" v={financials.due_date} />
                <Field label="Finanzierungspartner" v={financials.financing_partner} />
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
              <CardHeader><CardTitle className="text-sm">Lieferung &amp; Vertrag</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                <Field label="Lieferart" v={delivery.delivery_type} />
                <Field label="Installation" v={delivery.installation_required} />
                <Field label="Schulung" v={delivery.training_required} />
                <Field label="NiSV-Schulung" v={delivery.nisv_training} />
                <Field label="Mediapaket" v={delivery.mediapaket} />
                <Field label="Garantie" v={delivery.warranty_period} />
                <Field label="Laufzeit" v={contract.runtime} />
                <Field label="Verkäufer" v={sales.salesperson} />
                <Field label="Provision %" v={sales.commission_rate} />
                <Field label="Kundenunterschrift" v={signatures.customer_signature_present} />
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
              <CardHeader><CardTitle className="text-sm">Positionen ({items.length})</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-secondary/60 text-muted-foreground uppercase tracking-wide">
                    <tr><th className="p-2 text-left">#</th><th className="p-2 text-left">Produkt</th><th className="p-2 text-left">SKU</th><th className="p-2 text-right">Menge</th><th className="p-2 text-right">EP</th><th className="p-2 text-right">Summe</th></tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.id} className="border-t border-border">
                        <td className="p-2">{it.position}</td>
                        <td className="p-2">{it.detected_product_name ?? '—'}</td>
                        <td className="p-2 text-muted-foreground">{it.detected_sku ?? '—'}</td>
                        <td className="p-2 text-right tabular-nums">{it.detected_quantity ?? '—'}</td>
                        <td className="p-2 text-right tabular-nums">{it.detected_unit_price ?? '—'}</td>
                        <td className="p-2 text-right tabular-nums">{it.detected_total_price ?? '—'}</td>
                      </tr>
                    ))}
                    {items.length === 0 && <tr><td colSpan={6} className="p-3 text-center text-muted-foreground">Keine Positionen erkannt.</td></tr>}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card className="border-emerald-500/40 bg-emerald-500/5">
              <CardContent className="p-4 text-sm">
                <div className="font-medium mb-1">Nächster Schritt: Prüfen &amp; Auftrag anlegen</div>
                <p className="text-xs text-muted-foreground mb-3">
                  Im Review-Assistenten kannst du alle erkannten Felder korrigieren, den Kunden matchen (oder neu anlegen), Positionen anpassen und den Auftrag verbindlich anlegen. Es werden keine Daten produktiv, bevor du bestätigst.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-black" onClick={() => nav(`/auftraege/pdf-import/${id}/review`)}>
                    Prüfen &amp; anlegen
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => nav('/auftraege/pdf-import')}>Zurück zur Liste</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
