import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, RefreshCw, Files, Sparkles } from 'lucide-react';

type DupGroup = { type: 'hash' | 'title'; key: string; count: number; documents: any[] };

export default function AlixDocsReindex() {
  const [limit, setLimit] = useState(25);
  const [force, setForce] = useState(false);
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const [dupLoading, setDupLoading] = useState(false);
  const [groups, setGroups] = useState<DupGroup[]>([]);

  async function runReindex() {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('alixdocs-reindex', {
        body: { limit, force },
      });
      if (error) throw error;
      setLastResult(data);
      toast.success(`KI-Verarbeitung gestartet: ${data?.processed ?? 0} Dokumente`);
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

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Sparkles className="h-7 w-7 text-primary" />
          AlixDocs — KI-Reindex & Duplikate
        </h1>
        <p className="text-muted-foreground mt-1">
          OCR- und KI-Verarbeitung nachträglich für Bestandsdokumente ausführen und Dubletten erkennen.
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
              <Input
                type="number"
                min={1}
                max={100}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value) || 25)}
              />
            </div>
            <div className="flex items-end gap-2">
              <input
                id="force"
                type="checkbox"
                checked={force}
                onChange={(e) => setForce(e.target.checked)}
              />
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
              {groups.map((g, i) => (
                <div key={i} className="border rounded p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant={g.type === 'hash' ? 'destructive' : 'secondary'}>
                      {g.type === 'hash' ? 'Identisch (Hash)' : 'Ähnlich (Titel+Kunde)'}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{g.count} Dokumente</span>
                  </div>
                  <ul className="text-sm space-y-1">
                    {g.documents.map((d: any) => (
                      <li key={d.id} className="flex justify-between gap-2">
                        <span className="truncate">{d.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(d.created_at).toLocaleDateString('de-DE')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
