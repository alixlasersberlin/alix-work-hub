import { useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import 'pdfjs-dist/web/pdf_viewer.css';

(pdfjs as any).GlobalWorkerOptions.workerSrc = workerUrl;

type Props = {
  url: string;
  onSelectionChange?: (text: string) => void;
};

/**
 * Rendert alle PDF-Seiten mit Canvas + Text-Layer (pdfjs).
 * Text lässt sich mit der Maus markieren und wird über
 * onSelectionChange nach oben gemeldet.
 */
export default function PdfSelectViewer({ url, onSelectionChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageCount, setPageCount] = useState(0);
  const [scale, setScale] = useState(1.35);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let doc: any = null;
    (async () => {
      setLoading(true);
      const container = containerRef.current;
      if (!container) return;
      container.innerHTML = '';
      try {
        doc = await (pdfjs as any).getDocument({ url, withCredentials: false }).promise;
        if (cancelled) return;
        setPageCount(doc.numPages);
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          if (cancelled) return;
          const viewport = page.getViewport({ scale });

          const pageWrap = document.createElement('div');
          pageWrap.className = 'pdfsel-page';
          pageWrap.style.position = 'relative';
          pageWrap.style.margin = '0 auto 12px';
          pageWrap.style.width = `${viewport.width}px`;
          pageWrap.style.height = `${viewport.height}px`;
          pageWrap.style.boxShadow = '0 1px 4px rgba(0,0,0,0.4)';
          pageWrap.style.background = '#fff';

          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.display = 'block';
          pageWrap.appendChild(canvas);

          const textLayerDiv = document.createElement('div');
          textLayerDiv.className = 'textLayer';
          (pdfjs as any).setLayerDimensions(textLayerDiv, viewport);
          pageWrap.appendChild(textLayerDiv);

          container.appendChild(pageWrap);

          await page.render({ canvasContext: canvas.getContext('2d')!, viewport, canvas }).promise;
          const textLayer = new (pdfjs as any).TextLayer({
            textContentSource: page.streamTextContent(),
            container: textLayerDiv,
            viewport,
          });
          await textLayer.render();
        }
      } catch (e) {
        console.error('[PdfSelectViewer] load failed', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (doc) try { doc.destroy(); } catch {}
    };
  }, [url, scale]);

  useEffect(() => {
    if (!onSelectionChange) return;
    const handler = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const text = sel.toString().trim();
      if (!text) return;
      // Nur wenn die Auswahl innerhalb des Viewers liegt
      const anchor = sel.anchorNode as Node | null;
      if (anchor && containerRef.current?.contains(anchor)) {
        onSelectionChange(text);
      }
    };
    document.addEventListener('selectionchange', handler);
    return () => document.removeEventListener('selectionchange', handler);
  }, [onSelectionChange]);

  return (
    <div className="pdfsel-root">
      <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
        <button
          className="px-2 py-1 rounded border border-border hover:bg-secondary"
          onClick={() => setScale((s) => Math.max(0.6, +(s - 0.2).toFixed(2)))}
          type="button"
        >−</button>
        <span>{Math.round(scale * 100)} %</span>
        <button
          className="px-2 py-1 rounded border border-border hover:bg-secondary"
          onClick={() => setScale((s) => Math.min(3, +(s + 0.2).toFixed(2)))}
          type="button"
        >+</button>
        <span className="ml-auto">{loading ? 'Lade PDF …' : `${pageCount} Seite(n)`}</span>
      </div>
      <div
        ref={containerRef}
        className="pdfsel-container overflow-auto rounded border border-border bg-neutral-900/40"
        style={{ height: 'calc(100vh - 260px)' }}
      />
      <style>{`
        .pdfsel-container .textLayer { opacity: 1; mix-blend-mode: multiply; }
        .pdfsel-container .textLayer ::selection { background: rgba(251, 191, 36, 0.55); }
        .pdfsel-container .textLayer span { cursor: text; }
      `}</style>
    </div>
  );
}
