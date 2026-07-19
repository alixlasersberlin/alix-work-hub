import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, RefreshCw, Files, Sparkles, Check, X, Trash2, Link2 } from 'lucide-react';

type DupGroup = { type: 'hash' | 'title'; key: string; count: number; documents: any[] };
type AiSuggestion = {
  id: string;
  title: string;
  category_id: string | null;
  ai_category_suggestion: string | null;
  ai_summary: string | null;
  tags: string[] | null;
  created_at: string;
};
type Cat = { id: string; code: string; name: string };

export default function AlixDocsReindex() {
  const [limit, setLimit] = useState(25);
  const [force, setForce] = useState(false);
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const [dupLoading, setDupLoading] = useState(false);
  const [groups, setGroups] = useState<DupGroup[]>([]);

  const [cats, setCats] = useState<Cat[]>([]);
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    supabase.from('alixdocs_categories').select('id, code, name').then(({ data }) => setCats(data ?? []));
    loadAiSuggestions();
  }, []);

  async function runReindex() {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('alixdocs-reindex', { body: { limit, force } });
      if (error) throw error;
      setLastResult(data);
      toast.success(`KI-Verarbeitung: ${data?.processed ?? 0} Dokumente`);
    } catch (e: any) {
      toast.error(e?.message || 'Fehler beim Reindex');
    } finally {
      setRunning(false);
    }
  }

  async function loadDuplicates() {
    setDupLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('alixdocs-duplicates', { body: {} });
      if (error) throw error;
      setGroups(data?.groups ?? []);
    } catch (e: any) {
      toast.error(e?.message || 'Fehler beim Laden der Duplikate');
    } finally {
      setDupLoading(false);
    }
  }

  async function markDuplicateOf(dupId: string, primaryId: string) {
    const { error } = await supabase
      .from('alixdocs_documents')
      .update({ duplicate_of: primaryId })
      .eq('id', dupId);
    if (error) return toast.error(error.message);
    await supabase.from('alixdocs_audit_log').insert({
      document_id: dupId, action: 'marked_duplicate', metadata: { primary: primaryId },
    });
    toast.success('Als Duplikat markiert');
    loadDuplicates();
  }

  async function softDeleteDoc(id: string) {
    if (!confirm('Dokument wirklich löschen (Soft-Delete)?')) return;
    const { error } = await supabase
      .from('alixdocs_documents')
      .update({ deleted_at: new Date().toISOString(), status: 'geloescht' })
      .eq('id', id);
    if (error) return toast.error(error.message);
    await supabase.from('alixdocs_audit_log').insert({
      document_id: id, action: 'duplicate_deleted', metadata: {},
    });
    toast.success('Gelöscht');
    loadDuplicates();
  }

  async function loadAiSuggestions() {
    setAiLoading(true);
    try {
      const { data, error } = await supabase
        .from('alixdocs_documents')
        .select('id, title, category_id, ai_category_suggestion, ai_summary, tags, created_at')
        .not('ai_category_suggestion', 'is', null)
        .is('deleted_at', null)
        .order('ai_processed_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setSuggestions((data ?? []) as any);
    } catch (e: any) {
      toast.error(e?.message || 'Fehler beim Laden der KI-Vorschläge');
    } finally {
      setAiLoading(false);
    }
  }

  async function applySuggestion(doc: AiSuggestion) {
    const target = cats.find((c) => c.code === doc.ai_category_suggestion);
    if (!target) return toast.error(`Kategorie „${doc.ai_category_suggestion}" nicht gefunden`);
    const { error } = await supabase
      .from('alixdocs_documents')
      .update({ category_id: target.id, ai_category_suggestion: null })
      .eq('id', doc.id);
    if (error) return toast.error(error.message);
    await supabase.from('alixdocs_audit_log').insert({
      document_id: doc.id, action: 'ai_category_applied',
      metadata: { category_code: target.code },
    });
    toast.success(`Kategorie „${target.name}" übernommen`);
    setSuggestions((s) => s.filter((x) => x.id !== doc.id));
  }

  async function rejectSuggestion(doc: AiSuggestion) {
    const { error } = await supabase
      .from('alixdocs_documents')
      .update({ ai_category_suggestion: null })
      .eq('id', doc.id);
    if (error) return toast.error(error.message);
    await supabase.from('alixdocs_audit_log').insert({
      document_id: doc.id, action: 'ai_category_rejected', metadata: {},
    });
    setSuggestions((s) => s.filter((x) => x.id !== doc.id));
  }

  const catName = (id: string | null) =>
    id ? cats.find((c) => c.id === id)?.name || '—' : '— (unbekannt)';

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Sparkles className="h-7 w-7 text-primary" />
          AlixDocs — KI-Reindex, Duplikate & Klassifizierung
        </h1>
        <p className="text-muted-foreground mt-1">
          OCR/KI nachziehen, Dubletten bereinigen und KI-Kategorievorschläge freigeben.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" /> KI-Batch starten
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Batchgröße (max. 100)</Label>
              <Input type="number" min={1} max={100} value={limit}
                onChange={(e) => setLimit(Number(e.target.value) || 25)} />
            </div>
            <div className="flex items-end gap-2">
              <input id="force" type="checkbox" checked={force}
                onChange={(e) => setForce(e.target.checked)} />
              <Label htmlFor="force">Auch bereits verarbeitete neu analysieren</Label>
            </div>
            <div className="flex items-end">
              <Button onClick={runReindex} disabled={running} className="w-full">
                {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Reindex starten
              </Button>
            </div>
          </div>
          {lastResult && (
            <div className="text-sm bg-muted rounded p-3">
              <div>Verarbeitet: <b>{lastResult.processed}</b></div>
              <div className="mt-1 text-muted-foreground">
                Erfolg: {lastResult.results?.filter((r: any) => r.status === 200).length ?? 0} —
                Fehler: {lastResult.results?.filter((r: any) => r.status && r.status !== 200).length ?? 0}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" /> KI-Kategorievorschläge ({suggestions.length})
          </CardTitle>
          <Button variant="outline" size="sm" onClick={loadAiSuggestions} disabled={aiLoading}>
            {aiLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Neu laden
          </Button>
        </CardHeader>
        <CardContent>
          {suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Keine offenen Vorschläge. Neue erscheinen nach dem KI-Reindex.
            </p>
          ) : (
            <div className="space-y-2">
              {suggestions.map((doc) => {
                const target = cats.find((c) => c.code === doc.ai_category_suggestion);
                return (
                  <div key={doc.id} className="border rounded p-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{doc.title}</div>
                      <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-2">
                        <span>Aktuell: <b>{catName(doc.category_id)}</b></span>
                        <span>→ KI-Vorschlag:{' '}
                          <Badge variant="secondary">{target?.name || doc.ai_category_suggestion}</Badge>
                        </span>
                      </div>
                      {doc.ai_summary && (
                        <div className="text-xs mt-2 text-muted-foreground line-clamp-2">{doc.ai_summary}</div>
                      )}
                      {doc.tags && doc.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {doc.tags.slice(0, 6).map((t, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{t}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <Button size="sm" onClick={() => applySuggestion(doc)} disabled={!target}>
                        <Check className="h-4 w-4 mr-1" /> Übernehmen
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => rejectSuggestion(doc)}>
                        <X className="h-4 w-4 mr-1" /> Verwerfen
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Files className="h-5 w-5" /> Duplikate
          </CardTitle>
          <Button variant="outline" size="sm" onClick={loadDuplicates} disabled={dupLoading}>
            {dupLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Prüfen
          </Button>
        </CardHeader>
        <CardContent>
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Duplikate geladen. Klick auf „Prüfen".</p>
          ) : (
            <div className="space-y-3">
              {groups.map((g, i) => {
                const primary = g.documents[0];
                return (
                  <div key={i} className="border rounded p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={g.type === 'hash' ? 'destructive' : 'secondary'}>
                        {g.type === 'hash' ? 'Identisch (Hash)' : 'Ähnlich (Titel+Kunde)'}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{g.count} Dokumente</span>
                    </div>
                    <ul className="text-sm space-y-1">
                      {g.documents.map((d: any, idx: number) => (
                        <li key={d.id} className="flex items-center justify-between gap-2 py-1 border-b last:border-0">
                          <div className="min-w-0 flex-1">
                            <span className="truncate block">
                              {idx === 0 && <Badge variant="default" className="mr-2 text-xs">Primär</Badge>}
                              {d.title}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(d.created_at).toLocaleDateString('de-DE')}
                            </span>
                          </div>
                          {idx > 0 && (
                            <div className="flex gap-1 shrink-0">
                              <Button size="sm" variant="outline" onClick={() => markDuplicateOf(d.id, primary.id)}>
                                <Link2 className="h-3 w-3 mr-1" /> Als Duplikat
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => softDeleteDoc(d.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
