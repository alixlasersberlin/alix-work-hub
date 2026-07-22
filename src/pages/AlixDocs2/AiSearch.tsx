import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles } from 'lucide-react';

type Source = { idx: number; id: string; title: string; snippet?: string };

export default function AlixDocs2AiSearch() {
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(false);

  const ask = async () => {
    if (!q.trim()) return;
    setLoading(true); setAnswer(''); setSources([]);
    const { data, error } = await supabase.functions.invoke('alixdocs2-ai-search', { body: { question: q.trim() } });
    setLoading(false);
    if (error) { setAnswer('Fehler: ' + error.message); return; }
    const d = data as any;
    setAnswer(d?.answer ?? '');
    setSources(d?.sources ?? []);
  };

  return (
    <div className="p-6 space-y-4 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-display gold-text flex items-center gap-2"><Sparkles className="w-6 h-6"/> KI-Suche</h1>
        <p className="text-sm text-muted-foreground">Frage stellen — Antwort mit Zitier-Fußnoten aus indexierten Dokumenten.</p>
      </div>
      <div className="flex gap-2">
        <Input placeholder="z. B. Wann läuft die Garantie von SN 12345 ab?" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && ask()} />
        <Button onClick={ask} disabled={loading}>{loading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Fragen'}</Button>
      </div>
      {answer && (
        <Card>
          <CardHeader><CardTitle className="text-base">Antwort</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="whitespace-pre-wrap text-sm">{answer}</p>
            {sources.length > 0 && (
              <div className="pt-3 border-t">
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Quellen</p>
                {sources.map(s => (
                  <div key={s.idx} className="text-xs mb-1">
                    <span className="font-mono text-primary">[{s.idx}]</span> <span className="font-medium">{s.title}</span>
                    {s.snippet && <span className="text-muted-foreground ml-2" dangerouslySetInnerHTML={{ __html: s.snippet }} />}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
