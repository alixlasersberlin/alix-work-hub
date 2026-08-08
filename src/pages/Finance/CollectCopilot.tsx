import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Send, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/infinity/PageHeader';

const SUGGESTIONS = [
  'Welche Kunden sind heute am wichtigsten?',
  'Zeige alle Forderungen über 10.000 € mit mehr als 45 Tagen Verzug.',
  'Wie hoch ist das aktuelle Ausfallrisiko für diesen Monat?',
  'Entwirf eine freundliche Zahlungserinnerung für einen Stammkunden.',
];

type Msg = { role: 'user' | 'assistant'; content: string };

export default function FinanceCollectCopilot() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  const ask = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const next = [...msgs, { role: 'user' as const, content: q }];
    setMsgs(next);
    setInput('');
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('collect-copilot', { body: { messages: next } });
    setBusy(false);
    if (error) {
      toast({ title: 'Anfrage fehlgeschlagen', description: error.message, variant: 'destructive' });
      return;
    }
    setMsgs([...next, { role: 'assistant', content: (data as any)?.answer ?? 'Keine Antwort.' }]);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance AI"
        subtitle="Fragen zum Forderungsbestand stellen und Entwürfe erzeugen lassen"
        icon={Bot}
        actions={<Button variant="outline" size="sm" asChild><Link to="/finance/collect">Command Center</Link></Button>}
      />

      <DataCard title="Vorschläge" icon={<Sparkles className="h-4 w-4 text-primary" />}>
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <Button key={s} size="sm" variant="outline" onClick={() => ask(s)} disabled={busy}>{s}</Button>
          ))}
        </div>
      </DataCard>

      <DataCard title="Dialog">
        <div className="space-y-3">
          {msgs.length === 0 && <p className="text-sm text-muted-foreground">Stelle eine Frage zu Forderungen, Risiken oder Maßnahmen.</p>}
          {msgs.map((m, i) => (
            <div key={i} className={`rounded-lg border border-border p-3 text-sm ${m.role === 'user' ? 'bg-muted/30' : ''}`}>
              <div className="mb-1 text-xs text-muted-foreground">{m.role === 'user' ? 'Frage' : 'Finance AI'}</div>
              <div className="whitespace-pre-wrap">{m.content}</div>
            </div>
          ))}
          {busy && <div className="text-sm text-muted-foreground">Finance AI denkt nach …</div>}
        </div>
        <div className="mt-4 flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input); } }}
            rows={2}
            placeholder="Frage eingeben …"
          />
          <Button onClick={() => ask(input)} disabled={busy || !input.trim()}><Send className="h-4 w-4" /></Button>
        </div>
      </DataCard>
    </div>
  );
}
