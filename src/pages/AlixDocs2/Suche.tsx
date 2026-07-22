import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search } from 'lucide-react';

type Hit = { id: string; title: string; doc_type?: string; snippet?: string; rank?: number };

export default function AlixDocs2Suche() {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!q.trim()) return;
    setLoading(true);
    const { data, error } = await supabase.rpc('alixdocs2_fts_search', { _query: q.trim(), _limit: 40 });
    setLoading(false);
    if (error) return;
    setHits((data as Hit[]) ?? []);
  };

  return (
    <div className="p-6 space-y-4 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-display gold-text flex items-center gap-2"><Search className="w-6 h-6"/> Suche</h1>
        <p className="text-sm text-muted-foreground">Volltext, KI-Tags, Entitäten. Trigram-Toleranz für Tippfehler.</p>
      </div>
      <div className="flex gap-2">
        <Input placeholder="z. B. Serien-Nr, Kundenname, Rechnungsnr…" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()} />
        <Button onClick={run} disabled={loading}>{loading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Suchen'}</Button>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{hits.length} Treffer</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {hits.map(h => (
            <div key={h.id} className="border rounded p-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium flex-1 truncate">{h.title}</span>
                {h.doc_type && <Badge variant="secondary">{h.doc_type}</Badge>}
              </div>
              {h.snippet && <p className="text-xs text-muted-foreground mt-1" dangerouslySetInnerHTML={{ __html: h.snippet }} />}
            </div>
          ))}
          {!loading && hits.length === 0 && <p className="italic text-xs text-muted-foreground text-center py-4">Keine Ergebnisse.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
