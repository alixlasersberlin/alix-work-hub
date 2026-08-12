import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, FileDown, FileText, Loader2, RefreshCw, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { onPdfCapture, type OrderDocKind } from '@/lib/order-docs/capture';
import {
  STEP_LABELS, STEP_ORDER, docBytes, docSignedUrl, fileStepPdf, loadProgress,
  mergePdfs, mergedFilename, type DocRow, type StepKey,
} from '@/lib/order-docs/workflow';

type Props = {
  orderId: string;
  orderNumber: string;
  customerId?: string | null;
  customerName?: string | null;
  /** Ruft die bestehenden Generatoren auf – keine Logik-Änderung an diesen. */
  onRunStep: (step: OrderDocKind) => void;
};

const HINTS: Record<StepKey, string> = {
  sepa: 'Erzeugt das SEPA-Lastschriftmandat mit den vorhandenen Auftrags- und Kundendaten.',
  mietkauf: 'Öffnet den bestehenden Mietkauf-Dialog – Werte sind aus dem Auftrag vorbelegt.',
  ratenplan: 'Öffnet den bestehenden Ratenplan-Dialog inkl. Fälligkeiten.',
  gesamt: 'Fügt SEPA-Mandat, Mietkauf und Ratenplan in dieser Reihenfolge zu einer PDF zusammen.',
};

export function OrderDocumentsWizard({ orderId, orderNumber, customerId, customerName, onRunStep }: Props) {
  const [progress, setProgress] = useState<Partial<Record<StepKey, DocRow>>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<StepKey | null>(null);

  const refresh = useCallback(async () => {
    try {
      setProgress(await loadProgress(orderId));
    } catch (e: any) {
      toast.error(e?.message || 'Status konnte nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Erzeugte PDFs der bestehenden Generatoren einsammeln und am Auftrag ablegen.
  useEffect(() => {
    return onPdfCapture((kind: OrderDocKind, blob, filename) => {
      void (async () => {
        try {
          setBusy(kind);
          await fileStepPdf({ step: kind, blob, orderId, customerId, orderNumber, filename });
          toast.success(`${STEP_LABELS[kind]} wurde am Auftrag abgelegt`);
          await refresh();
        } catch (e: any) {
          toast.error(e?.message || 'Ablage fehlgeschlagen');
        } finally {
          setBusy(null);
        }
      })();
    });
  }, [orderId, customerId, orderNumber, refresh]);

  async function handleMerge() {
    const parts: DocRow[] = [];
    for (const s of ['sepa', 'mietkauf', 'ratenplan'] as StepKey[]) {
      const d = progress[s];
      if (d) parts.push(d);
    }
    if (parts.length === 0) { toast.error('Es liegen noch keine Dokumente vor'); return; }
    setBusy('gesamt');
    try {
      const bytes: Uint8Array[] = [];
      for (const p of parts) bytes.push(await docBytes(p));
      const blob = await mergePdfs(bytes);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = mergedFilename(orderNumber, customerName);
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      await fileStepPdf({ step: 'gesamt', blob, orderId, customerId, orderNumber, filename: mergedFilename(orderNumber, customerName) });
      toast.success('Gesamt-PDF erstellt und am Auftrag abgelegt');
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || 'Zusammenführen fehlgeschlagen');
    } finally {
      setBusy(null);
    }
  }

  async function openDoc(d: DocRow) {
    try {
      const url = await docSignedUrl(d);
      window.open(url, '_blank', 'noopener');
    } catch (e: any) {
      toast.error(e?.message || 'Dokument konnte nicht geöffnet werden');
    }
  }

  const done = STEP_ORDER.filter((s) => s !== 'gesamt' && progress[s]).length;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 card-glow">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> Geführte Dokumentenerstellung
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Schritt für Schritt: SEPA Mandat → Mietkauf → Ratenplan → Gesamt-PDF. Alle Dokumente bleiben
              zusätzlich einzeln am Auftrag gespeichert.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{done} / 3 erstellt</Badge>
            <Button size="sm" variant="ghost" onClick={() => void refresh()} disabled={loading}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {STEP_ORDER.map((step, idx) => {
          const doc = progress[step];
          const isMerge = step === 'gesamt';
          const running = busy === step;
          return (
            <div key={step} className="rounded-xl border border-border bg-card p-4 flex items-start gap-4">
              <div className="mt-0.5">
                {doc ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Circle className="w-5 h-5 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground">{idx + 1}. {STEP_LABELS[step]}</span>
                  {doc ? (
                    <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Vorhanden</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">Offen</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{HINTS[step]}</p>
                {doc && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {doc.title} · {new Date(doc.created_at).toLocaleString('de-DE')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {doc && (
                  <Button size="sm" variant="ghost" onClick={() => void openDoc(doc)}>
                    <Eye className="w-3.5 h-3.5 mr-1.5" /> Ansehen
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={doc ? 'outline' : 'default'}
                  disabled={running}
                  onClick={() => (isMerge ? void handleMerge() : onRunStep(step as OrderDocKind))}
                >
                  {running ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5 mr-1.5" />}
                  {isMerge ? 'Gesamt-PDF erzeugen' : doc ? 'Neu erstellen' : 'Erstellen'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
