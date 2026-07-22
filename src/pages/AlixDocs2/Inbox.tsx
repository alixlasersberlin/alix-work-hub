import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, Sparkles, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

type Doc = { id: string; title?: string; nc_path: string; status: string; doc_type?: string; ai_confidence?: number; ai_tags?: string[]; created_at: string; };
type Suggestion = { linked_type: string; linked_id: string; label: string; confidence: number; reason: string };

export default function AlixDocs2Inbox() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion[]>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('alixdocs2_documents')
      .select('id, title, nc_path, status, doc_type, ai_confidence, ai_tags, created_at')
      .is('deleted_at', null).order('created_at', { ascending: false }).limit(200);
    setDocs((data as Doc[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const analyze = async (id: string) => {
    setBusy(b => ({ ...b, [id]: true }));
    const { data, error } = await supabase.functions.invoke('alixdocs2-analyze', { body: { document_id: id } });
    setBusy(b => ({ ...b, [id]: false }));
    if (error) toast.error('Analyse fehlgeschlagen: ' + error.message);
    else { toast.success(`Analysiert: ${(data as any)?.doc_type ?? '—'}`); load(); }
  };

  const match = async (id: string) => {
    setBusy(b => ({ ...b, [id]: true }));
    const { data, error } = await supabase.functions.invoke('alixdocs2-match', { body: { document_id: id } });
    setBusy(b => ({ ...b, [id]: false }));
    if (error) toast.error(error.message);
    else setSuggestions(s => ({ ...s, [id]: (data as any)?.suggestions ?? [] }));
  };

  const apply = async (id: string, key: string) => {
    setBusy(b => ({ ...b, [id]: true }));
    const { error } = await supabase.functions.invoke('alixdocs2-match', { body: { document_id: id, apply: [key] } });
    setBusy(b => ({ ...b, [id]: false }));
    if (error) toast.error(error.message);
    else { toast.success('Zugeordnet'); load(); setSuggestions(s => { const c = { ...s }; delete c[id]; return c; }); }
  };

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display gold-text">📥 Posteingang — ALIXDocs AI 2.0</h1>
          <p className="text-sm text-muted-foreground">KI-Analyse, Auto-Zuordnung.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/alixdocs2/suche"><Button variant="outline" size="sm">🔎 Suche</Button></Link>
          <Link to="/alixdocs2/ai"><Button variant="outline" size="sm"><Sparkles className="w-4 h-4 mr-1"/>KI-Suche</Button></Link>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{loading ? 'Lade…' : `${docs.length} Dokument(e)`}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {loading ? <Loader2 className="w-5 h-5 animate-spin"/> :
            docs.length === 0 ? <p className="italic text-sm text-muted-foreground py-6 text-center">Noch keine Dokumente.</p> :
            docs.map(d => (
              <div key={d.id} className="border rounded p-3 space-y-2">
                <div className="flex items-center gap-3 text-sm">
                  <FileText className="w-4 h-4 text-primary shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{d.title || d.nc_path}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {d.nc_path} · {new Date(d.created_at).toLocaleString('de-DE')}
                      {d.ai_confidence != null && ` · KI ${Math.round(d.ai_confidence * 100)}%`}
                    </div>
                    {d.ai_tags && d.ai_tags.length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-1">
                        {d.ai_tags.slice(0, 6).map(t => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
                      </div>
                    )}
                  </div>
                  <Badge variant="outline">{d.status}</Badge>
                  {d.doc_type && <Badge variant="secondary">{d.doc_type}</Badge>}
                  <Button size="sm" variant="ghost" disabled={busy[d.id]} onClick={() => analyze(d.id)}>
                    {busy[d.id] ? <Loader2 className="w-3 h-3 animate-spin"/> : '🧠 Analyse'}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy[d.id]} onClick={() => match(d.id)}>🎯 Zuordnen</Button>
                </div>
                {suggestions[d.id] && (
                  <div className="pl-6 space-y-1">
                    {suggestions[d.id].length === 0 && <p className="text-xs italic text-muted-foreground">Keine Vorschläge.</p>}
                    {suggestions[d.id].slice(0, 3).map(s => (
                      <div key={`${s.linked_type}:${s.linked_id}`} className="flex items-center gap-2 text-xs">
                        <Badge className="bg-primary/20 text-primary border-primary/40">{Math.round(s.confidence * 100)}%</Badge>
                        <span className="capitalize">{s.linked_type}</span>
                        <span className="flex-1 truncate">{s.label}</span>
                        <span className="text-muted-foreground">{s.reason}</span>
                        <Button size="sm" variant="outline" className="h-6 px-2" onClick={() => apply(d.id, `${s.linked_type}:${s.linked_id}`)}>
                          <Check className="w-3 h-3 mr-1"/>Übernehmen
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          }
        </CardContent>
      </Card>
    </div>
  );
}
