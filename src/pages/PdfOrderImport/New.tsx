import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/infinity/PageHeader';
import { FileText, Upload, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { loadPdfOrderImportConfig, DEFAULT_PDF_IMPORT_CONFIG } from '@/lib/pdf-order-import-config';

const DOC_TYPES_ALL: Array<{ v: string; label: string }> = [
  { v: 'purchase_order', label: 'Auftrag / Kaufvertrag' },
  { v: 'sales_contract', label: 'Kaufvertrag' },
  { v: 'rental_contract', label: 'Mietvertrag' },
  { v: 'leasing_contract', label: 'Leasingvertrag' },
  { v: 'order_confirmation', label: 'Auftragsbestätigung' },
  { v: 'offer', label: 'Angebot' },
  { v: 'financing_order', label: 'Finanzierungsauftrag' },
  { v: 'device_order', label: 'Gerätebestellung' },
  { v: 'service_order', label: 'Serviceauftrag' },
  { v: 'other', label: 'Sonstiges Auftragsdokument' },
];

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function PdfOrderImportNew() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState('purchase_order');
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [maxSizeMb, setMaxSizeMb] = useState<number>(DEFAULT_PDF_IMPORT_CONFIG.max_file_size_mb);
  const [activeTypes, setActiveTypes] = useState<string[]>(DEFAULT_PDF_IMPORT_CONFIG.active_doc_types);

  const docTypes = DOC_TYPES_ALL.filter((t) => activeTypes.includes(t.v));

  useEffect(() => {
    document.title = 'PDF-Auftragsimport · Alix Work';
    loadPdfOrderImportConfig().then((cfg) => {
      setMaxSizeMb(cfg.max_file_size_mb);
      setActiveTypes(cfg.active_doc_types);
      if (!cfg.active_doc_types.includes('purchase_order') && cfg.active_doc_types[0]) {
        setDocType(cfg.active_doc_types[0]);
      }
    });
  }, []);

  function pickFile(f: File | undefined | null) {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Nur PDF-Dateien sind erlaubt.');
      return;
    }
    if (f.size > maxSizeMb * 1024 * 1024) {
      toast.error(`Datei ist größer als ${maxSizeMb} MB.`);
      return;
    }
    setFile(f);
  }

  function pickFile(f: File | undefined | null) {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Nur PDF-Dateien sind erlaubt.');
      return;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Datei ist größer als ${MAX_SIZE_MB} MB.`);
      return;
    }
    setFile(f);
  }

  async function onUpload() {
    if (!file || !user) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const hash = await sha256Hex(buf);

      // Dublettencheck vorab
      const { data: dupes } = await supabase
        .from('pdf_order_imports')
        .select('id, status')
        .eq('document_hash', hash)
        .limit(1);
      if (dupes && dupes.length > 0) {
        const ok = window.confirm(
          'Diese PDF wurde bereits einmal hochgeladen. Trotzdem erneut importieren?',
        );
        if (!ok) { setBusy(false); return; }
      }

      const month = new Date().toISOString().slice(0, 7);
      const id = crypto.randomUUID();
      const path = `${user.id}/${month}/${id}.pdf`;

      const { error: upErr } = await supabase.storage
        .from('order-imports')
        .upload(path, file, { contentType: 'application/pdf', upsert: false });
      if (upErr) throw upErr;

      const { data: ins, error: insErr } = await supabase
        .from('pdf_order_imports')
        .insert({
          id,
          uploaded_by: user.id,
          source_filename: file.name,
          source_storage_path: path,
          source_size_bytes: file.size,
          source_mime: 'application/pdf',
          document_type: docType as any,
          document_hash: hash,
          status: 'uploaded',
        })
        .select('id')
        .single();
      if (insErr) throw insErr;

      toast.success('PDF hochgeladen. KI-Analyse gestartet …');

      // Analyse anstoßen (Fire-and-forget mit Warteanzeige)
      supabase.functions.invoke('pdf-order-analyze', { body: { import_id: ins.id } }).then(
        ({ error }) => {
          if (error) toast.error('KI-Analyse fehlgeschlagen: ' + error.message);
        },
      );

      nav(`/auftraege/pdf-import/${ins.id}`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Upload fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={FileText} title="Auftrag aus PDF importieren" subtitle="KI-gestützte Erfassung aus Kaufvertrag, Angebot, Auftragsbestätigung o.ä." />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border/60 bg-card/40 backdrop-blur-xl">
          <CardHeader><CardTitle className="text-base">1. PDF auswählen</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault(); setDrag(false);
                pickFile(e.dataTransfer.files?.[0]);
              }}
              className={`rounded-xl border-2 border-dashed transition-colors p-10 text-center ${
                drag ? 'border-amber-400 bg-amber-400/5' : 'border-border/60'
              }`}
            >
              <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm mb-2">
                PDF hierher ziehen oder{' '}
                <label className="text-amber-300 underline cursor-pointer">
                  Datei auswählen
                  <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
                </label>
              </p>
              <p className="text-xs text-muted-foreground">Max. {MAX_SIZE_MB} MB · nur PDF</p>
              {file && (
                <div className="mt-4 text-sm inline-flex items-center gap-2 rounded-md bg-secondary/60 px-3 py-2">
                  <FileText className="w-4 h-4" />
                  <span className="font-medium">{file.name}</span>
                  <span className="text-muted-foreground text-xs">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                </div>
              )}
            </div>

            <div className="grid gap-2 max-w-md">
              <label className="text-sm font-medium">Dokumenttyp</label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DOC_TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Die KI erkennt den Typ eigenständig – deine Auswahl dient als Fallback.</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => nav('/auftraege/pdf-import')}>Abbrechen</Button>
              <Button
                onClick={onUpload}
                disabled={!file || busy}
                className="bg-amber-500 hover:bg-amber-600 text-black gap-2"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Hochladen &amp; analysieren
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-emerald-500/40 bg-emerald-500/5">
            <CardContent className="p-4 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm">Das Dokument wird ausschließlich für den Auftragsimport in Alix Work verarbeitet. Bitte lade nur geschäftlich erforderliche Dokumente hoch (DSGVO).</p>
            </CardContent>
          </Card>
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm">KI-Ergebnisse müssen vor dem endgültigen Anlegen des Auftrags immer geprüft werden. Es wird kein Auftrag ohne deine Bestätigung erstellt.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
