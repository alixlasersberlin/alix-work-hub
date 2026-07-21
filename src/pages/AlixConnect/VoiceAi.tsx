import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Loader2, Mic, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

type Call = {
  id: string; direction: string | null; from_number: string | null; to_number: string | null;
  started_at: string; duration_seconds: number | null; recording_url: string | null;
  transcript: string | null; transcript_status: string | null;
  sentiment: string | null; sentiment_score: number | null; summary: string | null;
  action_items: any;
};

const sentimentColor = (s: string | null) =>
  s === 'positiv' ? 'bg-emerald-500/15 text-emerald-500'
  : s === 'negativ' ? 'bg-rose-500/15 text-rose-500'
  : s === 'neutral' ? 'bg-slate-500/15 text-slate-400'
  : 'bg-muted text-muted-foreground';

export default function VoiceAi() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('ac_calls')
      .select('id,direction,from_number,to_number,started_at,duration_seconds,recording_url,transcript,transcript_status,sentiment,sentiment_score,summary,action_items')
      .not('recording_url', 'is', null)
      .order('started_at', { ascending: false })
      .limit(100);
    if (error) toast.error(error.message);
    setCalls((data ?? []) as Call[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function process(id: string) {
    setProcessing(id);
    const { data, error } = await supabase.functions.invoke('ac-call-ai-process', { body: { call_id: id } });
    setProcessing(null);
    if (error || (data as any)?.error) { toast.error((error?.message) || (data as any)?.error || 'Fehler'); return; }
    toast.success('AI-Analyse fertig');
    load();
  }

  return (
    <div className="p-6 space-y-4 h-full overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Mic className="w-5 h-5 text-primary" /> Voice AI</h2>
          <p className="text-xs text-muted-foreground">Transkript, Sentiment & Action-Items für alle 3CX-Anrufe mit Aufnahme.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-1.5" />Aktualisieren</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin w-6 h-6 text-muted-foreground" /></div>
      ) : calls.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Keine Anrufe mit Aufnahmen vorhanden.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {calls.map((c) => (
            <Card key={c.id} className="bg-card/40">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm">
                      {c.direction === 'inbound' ? '⬇' : '⬆'} {c.from_number || '—'} → {c.to_number || '—'}
                    </CardTitle>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {new Date(c.started_at).toLocaleString('de-DE')} · {c.duration_seconds ?? 0}s
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {c.sentiment && (
                      <Badge className={sentimentColor(c.sentiment)}>
                        {c.sentiment}{c.sentiment_score != null ? ` (${c.sentiment_score.toFixed(2)})` : ''}
                      </Badge>
                    )}
                    {c.transcript_status === 'processing' && <Badge variant="outline">verarbeitet…</Badge>}
                    <Button size="sm" variant="secondary" onClick={() => process(c.id)} disabled={processing === c.id}>
                      {processing === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
                      {c.transcript ? 'Neu analysieren' : 'Transkribieren & analysieren'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                {c.summary && (
                  <div>
                    <p className="text-[11px] uppercase text-muted-foreground mb-0.5">Zusammenfassung</p>
                    <p className="text-sm">{c.summary}</p>
                  </div>
                )}
                {Array.isArray(c.action_items) && c.action_items.length > 0 && (
                  <div>
                    <p className="text-[11px] uppercase text-muted-foreground mb-0.5">Action Items</p>
                    <ul className="list-disc list-inside text-sm space-y-0.5">
                      {c.action_items.map((a: string, i: number) => <li key={i}>{a}</li>)}
                    </ul>
                  </div>
                )}
                {c.transcript && (
                  <details>
                    <summary className="text-xs text-primary cursor-pointer">Transkript anzeigen</summary>
                    <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground max-h-64 overflow-auto">{c.transcript}</p>
                  </details>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
