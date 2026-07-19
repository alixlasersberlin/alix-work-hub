import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
// pdfjs
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import * as pdfjsLib from 'pdfjs-dist';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
(pdfjsLib as any).GlobalWorkerOptions.workerSrc = workerUrl;

export default function AlixDocsPreview() {
  const [params] = useSearchParams();
  const docId = params.get('doc') ?? '';
  const initialQ = params.get('q') ?? '';
  const [q, setQ] = useState(initialQ);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState<string>('');
  const [pdf, setPdf] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [hits, setHits] = useState<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!docId) return;
    (async () => {
      setLoading(true);
      try {
        const { data: meta } = await supabase
          .from('alixdocs_documents')
          .select('title, current_version, mime_type')
          .eq('id', docId).maybeSingle();
        setTitle((meta as any)?.title ?? 'Dokument');

        const { data, error } = await supabase.functions.invoke('alixdocs-signed-url', {
          body: { document_id: docId, version_number: (meta as any)?.current_version ?? 1 },
        });
        if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
        const url = (data as any).url;

        const loadingTask = (pdfjsLib as any).getDocument({ url });
        const doc = await loadingTask.promise;
        setPdf(doc);
        setNumPages(doc.numPages);
        setPage(1);
      } catch (e: any) {
        toast.error(e?.message ?? 'Fehler beim Laden');
      } finally { setLoading(false); }
    })();
  }, [docId]);

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    (async () => {
      const p = await pdf.getPage(page);
      const viewport = p.getViewport({ scale: 1.4 });
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d')!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await p.render({ canvasContext: ctx, viewport }).promise;

      // Text layer overlay for highlighting
      const layer = textLayerRef.current;
      if (!layer) return;
      layer.innerHTML = '';
      layer.style.width = `${viewport.width}px`;
      layer.style.height = `${viewport.height}px`;
      const txt = await p.getTextContent();
      const terms = q.trim().toLowerCase().split(/\s+/).filter(t => t.length >= 2);
      let localHits = 0;
      for (const item of txt.items as any[]) {
        const tx = (pdfjsLib as any).Util.transform(viewport.transform, item.transform);
        const span = document.createElement('span');
        const str = String(item.str);
        const lower = str.toLowerCase();
        const match = terms.some(t => lower.includes(t));
        span.textContent = str;
        span.style.position = 'absolute';
        span.style.left = `${tx[4]}px`;
        span.style.top = `${tx[5] - item.height * viewport.scale}px`;
        span.style.fontSize = `${item.height * viewport.scale}px`;
        span.style.whiteSpace = 'pre';
        span.style.color = 'transparent';
        span.style.pointerEvents = 'none';
        if (match) {
          span.style.background = 'rgba(250, 204, 21, 0.55)';
          span.style.color = 'transparent';
          localHits++;
        }
        layer.appendChild(span);
      }
      setHits(localHits);
    })();
  }, [pdf, page, q]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/dokumente"><ArrowLeft className="h-4 w-4 mr-1" /> Zurück</Link>
        </Button>
        <h1 className="text-xl font-semibold flex-1 truncate">{title}</h1>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Search className="h-4 w-4" /> Treffer markieren
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 items-center flex-wrap">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suchbegriff…" className="max-w-sm" />
            <Badge variant="secondary">{hits} Treffer auf Seite {page}</Badge>
            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">{page} / {numPages || '—'}</span>
              <Button size="sm" variant="outline" onClick={() => setPage(p => Math.min(numPages, p + 1))} disabled={page >= numPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <div className="relative inline-block border rounded shadow-sm bg-white">
              <canvas ref={canvasRef} className="block" />
              <div ref={textLayerRef} className="absolute inset-0" style={{ pointerEvents: 'none' }} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
