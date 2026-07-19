import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Loader2, ZoomIn, ZoomOut } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(pdfjsLib as any).GlobalWorkerOptions.workerSrc = workerUrl;

type Props = { url: string };

/**
 * Inline PDF-Preview via pdfjs. Signed Supabase-URLs werden per fetch geladen
 * (kein Iframe -> keine Probleme mit Content-Disposition: attachment).
 */
export default function PdfPreview({ url }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pdf, setPdf] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let doc: any = null;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const task = (pdfjsLib as any).getDocument({ url, withCredentials: false });
        doc = await task.promise;
        if (cancelled) return;
        setPdf(doc);
        setNumPages(doc.numPages);
        setPage(1);
      } catch (e: any) {
        console.error('[PdfPreview] load failed', e);
        setError(e?.message || 'PDF konnte nicht geladen werden');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (doc) try { doc.destroy(); } catch { /* noop */ }
    };
  }, [url]);

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    let cancelled = false;
    (async () => {
      const p = await pdf.getPage(page);
      if (cancelled) return;
      const viewport = p.getViewport({ scale });
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d')!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await p.render({ canvasContext: ctx, viewport, canvas }).promise;
    })();
    return () => { cancelled = true; };
  }, [pdf, page, scale]);

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-sm text-muted-foreground gap-2 p-6">
        <p className="text-destructive">{error}</p>
        <a href={url} target="_blank" rel="noopener" className="text-primary hover:underline">
          PDF in neuem Tab öffnen
        </a>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-neutral-900/40">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border text-xs">
        <Button size="sm" variant="ghost" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="tabular-nums">
          Seite {page} / {numPages || '—'}
        </span>
        <Button size="sm" variant="ghost" onClick={() => setPage(p => Math.min(numPages, p + 1))} disabled={page >= numPages}>
          <ChevronRight className="w-4 h-4" />
        </Button>
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => setScale(s => Math.max(0.5, +(s - 0.2).toFixed(2)))}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="tabular-nums w-12 text-center">{Math.round(scale * 100)}%</span>
          <Button size="sm" variant="ghost" onClick={() => setScale(s => Math.min(3, +(s + 0.2).toFixed(2)))}>
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto flex items-start justify-center p-4">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" /> PDF wird geladen…
          </div>
        ) : (
          <canvas ref={canvasRef} className="shadow-lg bg-white" />
        )}
      </div>
    </div>
  );
}
