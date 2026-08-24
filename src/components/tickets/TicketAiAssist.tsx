import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Sparkles, Loader2, ClipboardCheck, Lightbulb, ChevronDown, ChevronUp, Copy } from 'lucide-react';

const TONES = [
  { v: 'freundlich, professionell, lösungsorientiert', l: 'Standard (freundlich)' },
  { v: 'sehr kurz und sachlich', l: 'Kurz & sachlich' },
  { v: 'ausführlich erklärend, technisch präzise', l: 'Ausführlich / technisch' },
  { v: 'deeskalierend, entschuldigend, sehr empathisch', l: 'Deeskalierend' },
];

interface SimilarCase {
  id: string;
  ticket_number?: string | null;
  title?: string | null;
  status?: string | null;
  category?: string | null;
  created_at?: string | null;
}

export function TicketAiAssist({ ticketId, onUseDraft }: { ticketId: string; onUseDraft: (text: string) => void }) {
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState<null | 'reply' | 'insights'>(null);
  const [tone, setTone] = useState(TONES[0].v);
  const [hint, setHint] = useState('');
  const [draft, setDraft] = useState('');
  const [shortDraft, setShortDraft] = useState('');
  const [insights, setInsights] = useState<string[]>([]);
  const [nextSteps, setNextSteps] = useState<string[]>([]);
  const [summary, setSummary] = useState('');
  const [missing, setMissing] = useState<string | null>(null);
  const [similar, setSimilar] = useState<SimilarCase[]>([]);

  async function run(mode: 'reply' | 'insights') {
    setLoading(mode);
    try {
      const { data, error } = await supabase.functions.invoke('ticket-ai-assist', {
        body: { ticket_id: ticketId, mode, tone, hint: hint.trim() || undefined },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSimilar(Array.isArray(data?.similar) ? data.similar : []);
      setInsights(Array.isArray(data?.insights) ? data.insights : []);
      if (mode === 'reply') {
        setDraft(String(data?.draft ?? ''));
        setShortDraft(String(data?.short_draft ?? ''));
        setMissing(data?.missing_info ?? null);
      } else {
        setSummary(String(data?.summary ?? ''));
        setNextSteps(Array.isArray(data?.next_steps) ? data.next_steps : []);
      }
    } catch (e: any) {
      toast.error('KI-Fehler: ' + (e?.message || e));
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium"
      >
        <Sparkles className="w-4 h-4 text-primary" />
        KI-Assistent · Antwortvorschlag &amp; ähnliche Fälle
        <span className="ml-auto">{open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger className="h-8 w-[220px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TONES.map(t => <SelectItem key={t.v} value={t.v} className="text-xs">{t.l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              value={hint}
              onChange={e => setHint(e.target.value)}
              placeholder="Optionaler Hinweis an die KI (z. B. Ersatzteil bestellt)"
              className="h-8 text-xs flex-1 min-w-[200px]"
            />
            <Button size="sm" className="h-8" onClick={() => run('reply')} disabled={!!loading}>
              {loading === 'reply' ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
              Antwort vorschlagen
            </Button>
            <Button size="sm" variant="outline" className="h-8" onClick={() => run('insights')} disabled={!!loading}>
              {loading === 'insights' ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Lightbulb className="w-3.5 h-3.5 mr-1" />}
              Fall-Infos
            </Button>
          </div>

          {draft && (
            <div className="rounded-md border border-border bg-background p-3 space-y-2">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Antwortentwurf</div>
              <p className="text-sm whitespace-pre-wrap">{draft}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="h-7 text-xs" onClick={() => { onUseDraft(draft); toast.success('Entwurf übernommen'); }}>
                  <ClipboardCheck className="w-3.5 h-3.5 mr-1" /> Übernehmen
                </Button>
                {shortDraft && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { onUseDraft(shortDraft); toast.success('Kurzfassung übernommen'); }}>
                    Kurzfassung übernehmen
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { navigator.clipboard.writeText(draft); toast.success('Kopiert'); }}>
                  <Copy className="w-3.5 h-3.5 mr-1" /> Kopieren
                </Button>
              </div>
              {missing && <div className="text-xs text-amber-600">Fehlende Info: {missing}</div>}
            </div>
          )}

          {summary && (
            <div className="rounded-md border border-border bg-background p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Zusammenfassung</div>
              <p className="text-sm whitespace-pre-wrap">{summary}</p>
            </div>
          )}

          {insights.length > 0 && (
            <div className="rounded-md border border-border bg-background p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Hinweise aus ähnlichen Fällen</div>
              <ul className="list-disc pl-4 space-y-1 text-sm">
                {insights.map((i, k) => <li key={k}>{i}</li>)}
              </ul>
            </div>
          )}

          {nextSteps.length > 0 && (
            <div className="rounded-md border border-border bg-background p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Nächste Schritte</div>
              <ul className="list-disc pl-4 space-y-1 text-sm">
                {nextSteps.map((i, k) => <li key={k}>{i}</li>)}
              </ul>
            </div>
          )}

          {similar.length > 0 && (
            <div className="rounded-md border border-border bg-background p-3 space-y-1">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Ähnliche abgeschlossene Tickets</div>
              {similar.map(s => (
                <Link key={s.id} to={`/tickets/${s.id}`} className="flex items-center gap-2 text-sm hover:underline">
                  <Badge variant="outline" className="text-[10px] max-w-[180px] truncate">{s.company_name || s.customer_name || s.ticket_number || 'Ticket'}</Badge>
                  <span className="truncate">{s.title || '—'}</span>
                  {s.category && <span className="text-xs text-muted-foreground ml-auto shrink-0">{s.category}</span>}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
