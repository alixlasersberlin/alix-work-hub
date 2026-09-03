/**
 * ALIX AI – Assistenzkarte im Chat (Prompt 5).
 * Kompakt, einklappbar, blockiert den Chat nie. Alle Ergebnisse sind
 * VORSCHLÄGE: Es wird niemals automatisch an Kunden gesendet.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, ChevronDown, ChevronUp, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  runAnalysis, fetchLatestClassification, fetchAiFlags, saveAiFeedback, confidencePct,
  TONES, type AiClassification, type AiFlags, type AiTone,
} from '@/lib/inbox/ai';

type Props = {
  conversationId: string;
  /** Übernimmt Text in das Eingabefeld – NICHT senden. */
  onInsertDraft: (text: string) => void;
  onOpenTicket?: (ticketId: string) => void;
  onApplyCategory?: (category: string) => void;
  onApplyPriority?: (priority: string) => void;
  onLinkDevice?: (deviceId: string) => void;
  /** ID der letzten Nachricht – steuert Debounce/Neuanalyse. */
  lastMessageId?: string | null;
};

const DEBOUNCE_MS = 6000;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-xs">
      <div className="w-28 shrink-0 text-muted-foreground">{label}</div>
      <div className="min-w-0 flex-1 break-words">{children}</div>
    </div>
  );
}

export default function AlixAiCard({
  conversationId, onInsertDraft, onOpenTicket, onApplyCategory, onApplyPriority, onLinkDevice, lastMessageId,
}: Props) {
  const [open, setOpen] = useState(false);
  const [flags, setFlags] = useState<AiFlags | null>(null);
  const [cls, setCls] = useState<AiClassification | null>(null);
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [tone, setTone] = useState<AiTone>('PROFESSIONELL');
  const [reply, setReply] = useState<string | null>(null);
  const [replyBusy, setReplyBusy] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [translation, setTranslation] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => { fetchAiFlags().then(setFlags).catch(() => setFlags(null)); }, []);
  useEffect(() => { fetchLatestClassification(conversationId).then(setCls).catch(() => {}); }, [conversationId]);

  const meta = (cls?.metadata ?? {}) as any;
  const stale = !!cls && !!lastMessageId && meta.last_message_id !== lastMessageId;

  const analyze = useCallback(async (force = false) => {
    if (busy) return;
    setBusy(true);
    setUnavailable(null);
    const res = await runAnalysis({ conversationId, type: 'CLASSIFICATION', force });
    setBusy(false);
    if (!res.ok) { setUnavailable(res.error ?? 'ALIX AI derzeit nicht verfügbar'); return; }
    if (res.classification) setCls(res.classification);
  }, [busy, conversationId]);

  // Kein AI-Spam: Analyse erst nach Ruhephase, und nur wenn kein aktuelles Ergebnis vorliegt.
  useEffect(() => {
    if (!flags?.ai_enabled || !flags?.ai_classification_enabled || dismissed) return;
    if (cls && !stale) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { analyze(!!cls); }, DEBOUNCE_MS);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [flags, cls, stale, dismissed, lastMessageId, analyze]);

  const conf = confidencePct(cls?.confidence);
  const errorCodes: string[] = meta.detected_error_codes ?? [];
  const missing: string[] = meta.missing_information ?? [];
  const ticketMatch = meta.ticket_match ?? null;
  const sales = meta.sales ?? null;
  const tech = meta.technical ?? null;

  const headline = useMemo(() => {
    if (!cls) return busy ? 'ALIX AI analysiert…' : 'Noch keine Analyse';
    const parts = [cls.category ?? '—', cls.priority ?? '—'];
    if (cls.detected_serial_number) parts.push(cls.detected_serial_number);
    return parts.join(' · ');
  }, [cls, busy]);

  if (flags && !flags.ai_enabled) return null;
  if (dismissed) return null;

  async function generateReply(regenerate = false) {
    setReplyBusy(true);
    const res = await runAnalysis<{ reply: string }>({ conversationId, type: 'REPLY', tone, force: regenerate });
    setReplyBusy(false);
    if (!res.ok) { toast.error(res.error ?? 'Antwortvorschlag fehlgeschlagen.'); return; }
    setReply(res.data?.reply ?? '');
  }

  async function run(type: 'SUMMARY' | 'QUESTIONS' | 'TRANSLATE' | 'ASK') {
    setBusy(true);
    const res = await runAnalysis<any>({ conversationId, type, question });
    setBusy(false);
    if (!res.ok) { toast.error(res.error ?? 'ALIX AI derzeit nicht verfügbar.'); return; }
    if (type === 'SUMMARY') setSummary(res.data);
    if (type === 'TRANSLATE') setTranslation(res.data?.translation ?? '');
    if (type === 'ASK') setAnswer(res.data?.answer ?? '');
    if (type === 'QUESTIONS') {
      const text = res.data?.followup_message ?? '';
      if (text) { onInsertDraft(text); toast.success('Rückfrage in das Eingabefeld übernommen (nicht gesendet).'); }
    }
  }

  return (
    <Card className="mx-3 mt-2 border-primary/30 bg-primary/[0.03]">
      <button
        type="button"
        className="flex w-full items-center gap-2 p-2 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Sparkles className="h-4 w-4 text-primary shrink-0" />
        <span className="text-xs font-semibold tracking-wide">ALIX AI</span>
        <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
          {unavailable ? 'derzeit nicht verfügbar' : headline}
          {conf !== null && !unavailable ? ` · ${conf} %` : ''}
        </span>
        {busy && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="space-y-3 border-t border-border/60 p-3 pt-2">
          {unavailable && (
            <div className="rounded-md border border-dashed border-border p-2 text-xs text-muted-foreground">
              {unavailable} — Chat, Ticket und Kundenakte funktionieren unverändert weiter.
            </div>
          )}

          {busy && !cls && <Skeleton className="h-24 w-full rounded-lg" />}

          {cls && (
            <div className="space-y-1.5">
              <Row label="Kategorie">
                <span className="font-medium">{cls.category}</span>
                {conf !== null && <span className="text-muted-foreground"> · {conf} %</span>}
                {meta.alternative_category && conf !== null && conf < 70 && (
                  <span className="text-muted-foreground"> / {meta.alternative_category} — KI unsicher, bitte prüfen</span>
                )}
              </Row>
              <Row label="Priorität">
                <Badge variant={cls.priority === 'P1' ? 'destructive' : 'secondary'}>{cls.priority}</Badge>
                {meta.safety_signal && (
                  <span className="ml-2 text-destructive">
                    Möglicherweise sicherheitsrelevanter Vorgang – sofortige menschliche Prüfung empfohlen.
                  </span>
                )}
              </Row>
              {cls.detected_serial_number && (
                <Row label="Seriennummer">
                  {cls.detected_serial_number}
                  {meta.device_ambiguous && <span className="text-amber-500"> · Mehrere Geräte möglich – bitte wählen</span>}
                </Row>
              )}
              {errorCodes.length > 0 && <Row label="Fehlercode">{errorCodes.join(', ')}</Row>}
              {cls.summary && <Row label="Problem">{cls.summary}</Row>}
              {cls.reasoning_summary && <Row label="Begründung">{cls.reasoning_summary}</Row>}
              {cls.suggested_action && <Row label="Empfehlung">{cls.suggested_action}</Row>}
              {meta.suggested_department && <Row label="Zuständig">{meta.suggested_department} (Vorschlag)</Row>}
              {meta.sentiment && meta.sentiment !== 'UNKLAR' && (
                <Row label="Stimmung">vermutlich {String(meta.sentiment).toLowerCase().replace('_', ' ')}</Row>
              )}
              {ticketMatch && (
                <Row label="Ticket">
                  Möglicherweise bestehendes Ticket {ticketMatch.number ?? ''} · Ähnlichkeit {ticketMatch.similarity} %
                </Row>
              )}
              {tech && flags?.ai_technical_triage_enabled && cls.category === 'TECHNIK' && (
                <div className="rounded-md border border-border/60 p-2 text-xs space-y-1">
                  <div className="font-semibold">TECHNIK CHECK</div>
                  <Row label="Symptom">{tech.symptom ?? 'Nicht bekannt'}</Row>
                  <Row label="Ausfall">{tech.outage}</Row>
                  <Row label="Behandlung">{tech.treatment_affected}</Row>
                  <Row label="Sicherheit">{tech.safety_relevant}</Row>
                </div>
              )}
              {sales?.is_lead && flags?.ai_sales_enabled && (
                <div className="rounded-md border border-border/60 p-2 text-xs space-y-1">
                  <div className="font-semibold">ALIX AI – SALES</div>
                  <Row label="Interesse">{sales.product_interest ?? 'Nicht bekannt'}</Row>
                  <Row label="Intention">{sales.intention ?? 'Nicht bekannt'}</Row>
                  <Row label="Zeitraum">{sales.timeframe ?? 'Nicht bekannt'}</Row>
                  <Row label="Lead Score">{sales.lead_score ?? 'Nicht bekannt'} (Vorschlag)</Row>
                </div>
              )}
              {missing.length > 0 && (
                <Row label="Fehlt noch">
                  <ul className="list-disc pl-4">{missing.map((m, i) => <li key={i}>{m}</li>)}</ul>
                </Row>
              )}
              {meta.duplicate_hint && <Row label="Hinweis">{meta.duplicate_hint}</Row>}
              <div className="pt-1 text-[10px] text-muted-foreground">
                KI-Vorschlag · {cls.model_name} · {cls.prompt_version} · {new Date(cls.created_at).toLocaleString('de-DE')}
              </div>
            </div>
          )}

          {/* Empfohlene Aktionen – jede einzeln bestätigen */}
          {cls && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" className="h-8 text-xs" disabled={replyBusy || !flags?.ai_reply_enabled} onClick={() => generateReply(false)}>
                {replyBusy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null} ANTWORT VORSCHLAGEN
              </Button>
              {ticketMatch && onOpenTicket && (
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onOpenTicket(ticketMatch.id)}>
                  TICKET ÖFFNEN
                </Button>
              )}
              {cls.category && onApplyCategory && (
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={async () => {
                  onApplyCategory(cls.category!);
                  await saveAiFeedback({ classificationId: cls.id, feedbackType: 'ACCEPTED', original: { category: cls.category } });
                  toast.success('Kategorie übernommen.');
                }}>
                  KATEGORIE ÜBERNEHMEN
                </Button>
              )}
              {cls.priority && onApplyPriority && (
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { onApplyPriority(cls.priority!); toast.success('Priorität übernommen.'); }}>
                  PRIORITÄT ÜBERNEHMEN
                </Button>
              )}
              {cls.detected_device_id && onLinkDevice && (
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onLinkDevice(cls.detected_device_id!)}>
                  GERÄT ZUORDNEN
                </Button>
              )}
              {missing.length > 0 && (
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => run('QUESTIONS')}>
                  RÜCKFRAGE ERSTELLEN
                </Button>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Select value={tone} onValueChange={(v) => setTone(v as AiTone)}>
              <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{TONES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="sm" variant="ghost" className="h-8 text-xs" disabled={busy} onClick={() => run('SUMMARY')}>CHAT ZUSAMMENFASSEN</Button>
            {flags?.ai_translation_enabled && (
              <Button size="sm" variant="ghost" className="h-8 text-xs" disabled={busy} onClick={() => run('TRANSLATE')}>ÜBERSETZEN</Button>
            )}
            <Button size="sm" variant="ghost" className="h-8 text-xs" disabled={busy} onClick={() => analyze(true)}>
              <RefreshCw className="mr-1 h-3 w-3" /> NEU ANALYSIEREN
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" onClick={() => setDismissed(true)}>IGNORIEREN</Button>
          </div>

          {reply !== null && (
            <div className="space-y-2 rounded-md border border-border p-2">
              <div className="text-[11px] font-semibold">Antwortvorschlag (KI · nicht gesendet)</div>
              <Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={5} className="text-sm" />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="h-8 text-xs" onClick={() => { onInsertDraft(reply); toast.success('In das Eingabefeld übernommen – Versand erfolgt manuell.'); }}>
                  ÜBERNEHMEN
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" disabled={replyBusy} onClick={() => generateReply(true)}>NEU GENERIEREN</Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={async () => {
                  setReply(null);
                  if (cls) await saveAiFeedback({ classificationId: cls.id, feedbackType: 'NOT_HELPFUL' });
                }}>VERWERFEN</Button>
              </div>
            </div>
          )}

          {summary && (
            <div className="rounded-md border border-border p-2 text-xs space-y-1">
              <div className="font-semibold">Kurzfassung</div>
              <Row label="Kunde">{summary.customer}</Row>
              <Row label="Gerät">{summary.device}</Row>
              <Row label="Problem">{summary.problem}</Row>
              <Row label="Bereits erledigt">{(summary.done_so_far ?? []).join(' · ') || 'Nicht bekannt'}</Row>
              <Row label="Offen">{(summary.open_questions ?? []).join(' · ') || 'Nicht bekannt'}</Row>
              <Row label="Letzte Zusage">{summary.last_promise}</Row>
              <Row label="Status">{summary.current_status}</Row>
              <Row label="Nächster Schritt">{summary.next_step}</Row>
            </div>
          )}

          {translation && (
            <div className="rounded-md border border-border p-2 text-xs">
              <div className="font-semibold">Interne Übersetzung (nicht an Kunden senden)</div>
              <div className="whitespace-pre-wrap">{translation}</div>
            </div>
          )}

          <div className="flex gap-2">
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="ALIX AI fragen (intern) …"
              className="h-8 text-xs"
            />
            <Button size="sm" variant="outline" className="h-8 text-xs" disabled={busy || !question.trim()} onClick={() => run('ASK')}>FRAGEN</Button>
          </div>
          {answer && <div className="rounded-md border border-border p-2 text-xs whitespace-pre-wrap">{answer}</div>}
        </div>
      )}
    </Card>
  );
}
