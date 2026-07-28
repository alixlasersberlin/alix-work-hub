import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Loader2, Database } from 'lucide-react';
import { toast } from 'sonner';

export function CopilotPanel({ documentId }: { documentId: string }) {
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [indexing, setIndexing] = useState(false);

  async function ask(action: 'chat' | 'summary' | 'risks' | 'classify', question?: string) {
    setBusy(true);
    setAnswer('');
    try {
      const { data, error } = await supabase.functions.invoke('alixdocs-copilot', {
        body: { document_id: documentId, action, question: question ?? q },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setAnswer((data as any).answer ?? '');
    } catch (e: any) {
      toast.error(e?.message ?? 'Copilot-Fehler');
    } finally {
      setBusy(false);
    }
  }

  async function reindex() {
    setIndexing(true);
    try {
      const { data, error } = await supabase.functions.invoke('alixdocs-embed', { body: { document_id: documentId } });
      if (error) throw error;
      toast.success(`Indiziert: ${(data as any)?.indexed ?? 0} Chunks`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Indexierung fehlgeschlagen');
    } finally {
      setIndexing(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" /> Copilot
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => ask('summary')}>Zusammenfassen</Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => ask('risks')}>Risiken & Fristen</Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => ask('classify')}>Klassifizieren</Button>
          <Button size="sm" variant="outline" disabled={indexing} onClick={reindex}>
            {indexing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Database className="w-3 h-3 mr-1" />}
            Für Suche indizieren
          </Button>
        </div>
        <Textarea
          rows={2}
          placeholder="Frage zum Dokument…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Button size="sm" onClick={() => ask('chat')} disabled={busy || !q.trim()}>
          {busy ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
          Fragen
        </Button>
        {answer && (
          <div className="border rounded p-3 bg-muted/50 text-sm whitespace-pre-wrap max-h-96 overflow-auto">
            {answer}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
