import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, Copy, ThumbsUp, ThumbsDown, Zap } from 'lucide-react';
import { toast } from 'sonner';

const types = [
  { key: 'next_reply', label: 'Nächste Antwort' },
  { key: 'kb_snippet', label: 'KB-Snippet' },
  { key: 'autocomplete', label: 'Auto-Complete' },
  { key: 'translate', label: 'Übersetzen' },
  { key: 'summary', label: 'Zusammenfassung' },
] as const;

export default function Copilot() {
  const [type, setType] = useState<(typeof types)[number]['key']>('next_reply');
  const [input, setInput] = useState('');
  const [history, setHistory] = useState('');
  const [lang, setLang] = useState('en');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ id?: string; content: string; latency_ms?: number; kb_count?: number } | null>(null);

  async function run() {
    if (!input.trim()) { toast.error('Bitte Text eingeben'); return; }
    setLoading(true); setResult(null);
    const { data, error } = await supabase.functions.invoke('ac-copilot', {
      body: {
        suggestion_type: type,
        context_type: 'chat',
        input,
        target_language: type === 'translate' ? lang : undefined,
        conversation_history: history || undefined,
      },
    });
    setLoading(false);
    if (error || (data as any)?.error) { toast.error((error?.message) || (data as any)?.error || 'Fehler'); return; }
    setResult(data as any);
  }

  async function feedback(accepted: boolean) {
    if (!result?.id) return;
    await supabase.from('ac_copilot_suggestions').update({ accepted }).eq('id', result.id);
    toast.success('Danke — Feedback gespeichert');
  }

  return (
    <div className="p-6 h-full overflow-auto">
      <div className="max-w-3xl mx-auto space-y-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" /> AI Copilot</h2>
          <p className="text-xs text-muted-foreground">Live-Vorschläge für Agenten: nächste Antwort, KB-Snippets, Auto-Complete, Übersetzung, Verlaufs-Zusammenfassung.</p>
        </div>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {types.map((t) => (
                <Button key={t.key} size="sm" variant={type === t.key ? 'default' : 'outline'} onClick={() => setType(t.key)}>{t.label}</Button>
              ))}
            </div>

            {type === 'translate' && (
              <Input placeholder="Zielsprache (z. B. en, tr, ar)" value={lang} onChange={(e) => setLang(e.target.value)} />
            )}
            <Textarea rows={5} placeholder={type === 'summary' ? 'Verlauf (der zusammengefasst werden soll)' : 'Kundennachricht bzw. Agenten-Anfangstext…'} value={input} onChange={(e) => setInput(e.target.value)} />
            {['next_reply','autocomplete'].includes(type) && (
              <Textarea rows={3} placeholder="Optionaler Verlauf für Kontext…" value={history} onChange={(e) => setHistory(e.target.value)} />
            )}
            <Button onClick={run} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
              Vorschlag generieren
            </Button>
          </CardContent>
        </Card>

        {result && (
          <Card className="border-primary/40">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Vorschlag</CardTitle>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                {result.latency_ms != null && <Badge variant="outline">{result.latency_ms} ms</Badge>}
                {result.kb_count != null && result.kb_count > 0 && <Badge variant="outline">{result.kb_count} KB</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="whitespace-pre-wrap text-sm">{result.content}</p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => { navigator.clipboard.writeText(result.content); toast.success('Kopiert'); }}>
                  <Copy className="w-4 h-4 mr-1" /> Kopieren
                </Button>
                <Button size="sm" variant="ghost" onClick={() => feedback(true)}><ThumbsUp className="w-4 h-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => feedback(false)}><ThumbsDown className="w-4 h-4" /></Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
