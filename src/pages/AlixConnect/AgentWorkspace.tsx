import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LayoutGrid, Phone, User, BookOpen, Bot, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/infinity/PageHeader';

type Call = { id: string; caller_number: string | null; started_at: string | null; direction: string | null; status: string | null; transcript: string | null; summary: string | null; sentiment: string | null; contact_id: string | null };
type Contact = { id: string; display_name: string | null; email: string | null; phone: string | null };
type Suggestion = { id: string; suggestion: string | null; category: string | null; created_at: string };
type Article = { id: string; title: string; content: string | null };

export default function AgentWorkspace() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [active, setActive] = useState<Call | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [kb, setKb] = useState<Article[]>([]);
  const [kbQuery, setKbQuery] = useState('');

  const loadCalls = async () => {
    const { data, error } = await supabase.from('ac_calls' as any)
      .select('id, caller_number, started_at, direction, status, transcript, summary, sentiment, contact_id')
      .order('started_at', { ascending: false }).limit(30);
    if (error) toast.error(error.message);
    setCalls((data as any) ?? []);
  };

  const openCall = async (c: Call) => {
    setActive(c);
    setContact(null); setSuggestions([]);
    if (c.contact_id) {
      const { data: ct } = await supabase.from('ac_contacts' as any)
        .select('id, display_name, email, phone').eq('id', c.contact_id).maybeSingle();
      setContact((ct as any) ?? null);
    }
    const { data: sug } = await supabase.from('ac_copilot_suggestions' as any)
      .select('id, suggestion, category, created_at').eq('call_id', c.id)
      .order('created_at', { ascending: false }).limit(10);
    setSuggestions((sug as any) ?? []);
  };

  const searchKb = async (q: string) => {
    setKbQuery(q);
    if (!q.trim()) { setKb([]); return; }
    const { data } = await supabase.from('ac_kb_articles' as any)
      .select('id, title, content').ilike('title', `%${q}%`).limit(10);
    setKb((data as any) ?? []);
  };

  useEffect(() => { loadCalls(); }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 pt-6 pb-3">
        <PageHeader title="Unified Agent Workspace" subtitle="Live-Call · Transcript · Copilot · Customer 360° · Knowledge in einer Oberfläche" icon={LayoutGrid} />
      </div>
      <div className="grid flex-1 gap-4 overflow-hidden px-6 pb-6 lg:grid-cols-[280px_1fr_320px]">
        {/* LEFT: call list */}
        <Card className="flex flex-col overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4" />Aktive Calls</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-2">
            <Button size="sm" variant="ghost" onClick={loadCalls} className="mb-2 w-full justify-start"><RefreshCw className="mr-2 h-3 w-3" />Aktualisieren</Button>
            <div className="space-y-1">
              {calls.map(c => (
                <button key={c.id} onClick={() => openCall(c)}
                  className={`w-full rounded-md border p-2 text-left text-xs transition ${active?.id === c.id ? 'border-primary bg-primary/10' : 'border-border/60 hover:bg-muted/40'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{c.caller_number ?? c.id.slice(0, 8)}</span>
                    <Badge variant="outline" className="text-[10px]">{c.direction ?? '—'}</Badge>
                  </div>
                  <div className="text-muted-foreground">{c.started_at ? new Date(c.started_at).toLocaleTimeString('de-DE') : '—'} · {c.status ?? ''}</div>
                </button>
              ))}
              {calls.length === 0 && <p className="p-2 text-xs text-muted-foreground">Keine Calls</p>}
            </div>
          </CardContent>
        </Card>

        {/* CENTER: transcript */}
        <Card className="flex flex-col overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Transcript · Zusammenfassung</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {!active && <p className="text-xs text-muted-foreground">Call links auswählen.</p>}
            {active && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  {active.sentiment && <Badge variant="outline">Sentiment: {active.sentiment}</Badge>}
                  <Badge variant="outline">{active.status ?? '—'}</Badge>
                </div>
                {active.summary && (
                  <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                    <h4 className="mb-1 text-xs font-medium">Zusammenfassung</h4>
                    <p className="text-xs">{active.summary}</p>
                  </div>
                )}
                <div>
                  <h4 className="mb-1 text-xs font-medium">Transcript</h4>
                  <pre className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">
                    {active.transcript ?? 'Kein Transcript vorhanden.'}
                  </pre>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* RIGHT: 360 + copilot + KB */}
        <div className="flex flex-col gap-4 overflow-auto">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><User className="h-4 w-4" />Customer 360°</CardTitle></CardHeader>
            <CardContent className="text-xs">
              {!contact && <p className="text-muted-foreground">Kein Kontakt verknüpft.</p>}
              {contact && (
                <div className="space-y-1">
                  <div className="font-medium">{contact.display_name ?? '—'}</div>
                  <div className="text-muted-foreground">{contact.email ?? ''}</div>
                  <div className="text-muted-foreground">{contact.phone ?? ''}</div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Bot className="h-4 w-4" />Copilot-Vorschläge</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {suggestions.length === 0 && <p className="text-xs text-muted-foreground">Keine Vorschläge.</p>}
              {suggestions.map(s => (
                <div key={s.id} className="rounded-md border border-border/60 p-2 text-xs">
                  {s.category && <Badge variant="outline" className="mb-1 text-[10px]">{s.category}</Badge>}
                  <div>{s.suggestion}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><BookOpen className="h-4 w-4" />Knowledge Base</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Input placeholder="Suchen…" value={kbQuery} onChange={e => searchKb(e.target.value)} className="h-8" />
              <div className="space-y-1">
                {kb.map(a => (
                  <div key={a.id} className="rounded-md border border-border/60 p-2 text-xs">
                    <div className="font-medium">{a.title}</div>
                    {a.content && <div className="mt-1 line-clamp-3 text-muted-foreground">{a.content}</div>}
                  </div>
                ))}
                {kbQuery && kb.length === 0 && <p className="text-xs text-muted-foreground">Keine Treffer</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
