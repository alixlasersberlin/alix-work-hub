import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

type Turn = { q: string; a: string };

const EXAMPLES = [
  'Wie hoch war der Umsatz im aktuellen Quartal?',
  'Welche offenen Rechnungen sind über 60 Tage fällig?',
  'Wie war der Umsatz im Januar?',
];

export default function FinanceAsk() {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Turn[]>([]);

  async function ask(question?: string) {
    const text = (question ?? q).trim();
    if (!text) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('finance-ai-ask', { body: { question: text } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setHistory(prev => [{ q: text, a: (data as any)?.answer ?? '' }, ...prev]);
      setQ('');
    } catch (e: any) {
      toast.error(e.message || 'Fehler');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <PageHeader title="Finanz-KI fragen" subtitle="Stelle Fragen zu Umsatz, offenen Posten, Kunden" />

      <DataCard title="Frage">
        <div className="space-y-3">
          <Textarea
            value={q} onChange={e => setQ(e.target.value)}
            placeholder="z.B. Wie hoch war der Umsatz mit Kunde X im Q2?"
            rows={3}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) ask(); }}
          />
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map(ex => (
                <Button key={ex} variant="outline" size="sm" onClick={() => ask(ex)} disabled={loading}>{ex}</Button>
              ))}
            </div>
            <Button onClick={() => ask()} disabled={loading || !q.trim()}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Fragen
            </Button>
          </div>
        </div>
      </DataCard>

      {history.map((t, i) => (
        <DataCard key={i} title={`Frage ${history.length - i}`}>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">{t.q}</div>
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 mt-1 text-primary" />
              <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans flex-1">{t.a}</pre>
            </div>
          </div>
        </DataCard>
      ))}
    </div>
  );
}
