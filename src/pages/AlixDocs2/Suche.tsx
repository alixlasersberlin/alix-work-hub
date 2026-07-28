import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Sparkles } from 'lucide-react';

type Hit = { id: string; title: string; doc_type?: string; snippet?: string; rank?: number; source?: 'fts' | 'semantic'; similarity?: number };

export default function AlixDocs2Suche() {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);

  const run = async (mode: 'fts' | 'hybrid') => {
    if (!q.trim()) return;
    setLoading(true);
    setHits([]);
    try {
      const ftsPromise = supabase.rpc('alixdocs2_fts_search', { _query: q.trim(), _limit: 40 });
      const semPromise = mode === 'hybrid'
        ? supabase.functions.invoke('alixdocs-embed', { body: { query: q.trim(), limit: 20 } })
        : Promise.resolve({ data: null, error: null } as any);

      const [{ data: fts }, sem] = await Promise.all([ftsPromise, semPromise]);
      const ftsHits: Hit[] = ((fts as any[]) ?? []).map((h) => ({ ...h, source: 'fts' as const }));

      let merged = ftsHits;
      if (mode === 'hybrid' && (sem as any)?.data?.hits?.length) {
        const semDocIds: { doc_id: string; content: string; similarity: number }[] = (sem as any).data.hits;
        // Titel für semantische Treffer holen
        const ids = Array.from(new Set(semDocIds.map((h) => h.doc_id)));
        const { data: docs } = await supabase
          .from('alixdocs2_documents')
          .select('id,title,doc_type')
          .in('id', ids);
        const bestPerDoc = new Map<string, { similarity: number; snippet: string }>();
        for (const h of semDocIds) {
          const prev = bestPerDoc.get(h.doc_id);
          if (!prev || h.similarity > prev.similarity) bestPerDoc.set(h.doc_id, { similarity: h.similarity, snippet: h.content.slice(0, 240) });
        }
        const semHits: Hit[] = (docs ?? []).map((d: any) => {
          const meta = bestPerDoc.get(d.id)!;
          return { id: d.id, title: d.title, doc_type: d.doc_type, snippet: meta.snippet, similarity: meta.similarity, source: 'semantic' as const };
        }).sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));

        const seen = new Set(ftsHits.map((h) => h.id));
        merged = [...ftsHits, ...semHits.filter((h) => !seen.has(h.id))];
      }
      setHits(merged);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-display gold-text flex items-center gap-2"><Search className="w-6 h-6"/> Enterprise Suche</h1>
        <p className="text-sm text-muted-foreground">Volltext + semantische Suche (KI-Embeddings) über OCR & Editor-Inhalt.</p>
      </div>
      <div className="flex gap-2">
        <Input placeholder="z. B. Serien-Nr, Kundenname, Rechnungsnr…" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && run('hybrid')} />
        <Button onClick={() => run('fts')} disabled={loading} variant="outline">Volltext</Button>
        <Button onClick={() => run('hybrid')} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <><Sparkles className="w-4 h-4 mr-1"/> Hybrid (KI)</>}
        </Button>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{hits.length} Treffer</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {hits.map(h => (
            <Link key={`${h.source}-${h.id}`} to={`/alixdocs2/dokument/${h.id}`} className="block border rounded p-2 text-sm hover:bg-muted transition">
              <div className="flex items-center gap-2">
                <span className="font-medium flex-1 truncate">{h.title}</span>
                {h.doc_type && <Badge variant="secondary">{h.doc_type}</Badge>}
                <Badge variant={h.source === 'semantic' ? 'default' : 'outline'} className="text-[10px]">
                  {h.source === 'semantic' ? `KI ${Math.round((h.similarity ?? 0) * 100)}%` : 'Text'}
                </Badge>
              </div>
              {h.snippet && <p className="text-xs text-muted-foreground mt-1" dangerouslySetInnerHTML={{ __html: h.snippet }} />}
            </Link>
          ))}
          {!loading && hits.length === 0 && <p className="italic text-xs text-muted-foreground text-center py-4">Keine Ergebnisse.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
