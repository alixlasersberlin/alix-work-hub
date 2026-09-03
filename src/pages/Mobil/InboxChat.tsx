import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Send, Paperclip, StickyNote, User2, UserPlus, Zap, Ticket, Loader2, X } from 'lucide-react';
import {
  fetchMessages, fetchEvents, markRead, addInternalNote, claimConversation,
  assignConversation, setStatus, setPriority, setCategory, displayName, relTime,
  normPriority, PRIORITY_LABEL, PRIORITY_ORDER, STATUS_LABEL, STATUS_ORDER, CATEGORIES,
  fetchFeatureFlags, fetchQuickReplies, windowOpen, uploadInboxMedia, sendWhatsApp,
  createTicketFromChat, fetchLinkedTickets, signedMediaUrl,
  type ConversationRow, type MessageRow, type InboxStatus, type Priority,
  type FeatureFlags, type QuickReply,
} from '@/lib/inbox/api';
import AlixAiCard from '@/components/inbox/AlixAiCard';

const STATUS_TEXT: Record<string, string> = {
  queued: 'in Warteschlange', sent: 'gesendet', delivered: 'zugestellt',
  read: 'gelesen', failed: 'fehlgeschlagen', internal: 'intern',
};

const DRAFT_KEY = (id: string) => `alix-inbox-draft-${id}`;

function MediaBubble({ att }: { att: any }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (att?.storage_path) signedMediaUrl(att.storage_path).then((u) => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [att?.storage_path]);
  const mime: string = att?.mime_type ?? '';
  if (url && mime.startsWith('image/')) {
    return <img src={url} alt={att.file_name ?? 'Anhang'} loading="lazy" className="rounded-lg max-h-56 object-cover" />;
  }
  return (
    <a href={url ?? undefined} target="_blank" rel="noreferrer" className="underline text-xs break-all">
      {att?.file_name ?? 'Anhang'}
    </a>
  );
}

export default function MobilInboxChat() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { user } = useAuth();
  const [conv, setConv] = useState<ConversationRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [draft, setDraft] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [customerOpen, setCustomerOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [staff, setStaff] = useState<any[]>([]);
  const [staffSearch, setStaffSearch] = useState('');
  const [customer, setCustomer] = useState<any>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [openTickets, setOpenTickets] = useState<number>(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [flags, setFlags] = useState<FeatureFlags | null>(null);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [quickOpen, setQuickOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [replyTo, setReplyTo] = useState<MessageRow | null>(null);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketBusy, setTicketBusy] = useState(false);
  const [ticketForm, setTicketForm] = useState({ title: '', description: '', department: 'SERVICE', priority: 'normal', category: '' });
  const [linkedTickets, setLinkedTickets] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setError(false);
      const { data, error: cErr } = await (supabase as any)
        .from('ac_conversations')
        .select(`id, channel_id, channel_type, customer_id, contact_id, assigned_to, assigned_department,
                 inbox_status, priority, category, subject, last_message_at, last_message_preview,
                 unread_count, customer_match_required, is_test, external_thread_id,
                 ac_contacts:contact_id ( full_name, phone, email, whatsapp_number, customer_id ),
                 ac_channels:channel_id ( name, department, provider )`)
        .eq('id', id).maybeSingle();
      if (cErr) throw cErr;
      setConv(data as ConversationRow);
      const [m, e] = await Promise.all([fetchMessages(id), fetchEvents(id)]);
      setMessages(m);
      setEvents(e);
      await markRead(id);
    } catch (err) {
      console.error('chat load failed', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  useEffect(() => {
    fetchFeatureFlags().then(setFlags).catch(() => setFlags(null));
    fetchQuickReplies().then(setQuickReplies).catch(() => setQuickReplies([]));
  }, []);

  useEffect(() => { if (id) fetchLinkedTickets(id).then(setLinkedTickets).catch(() => {}); }, [id]);

  // Entwurf lokal sichern (Verbindungsabbruch darf keinen Text kosten)
  useEffect(() => { if (id) setDraft(localStorage.getItem(DRAFT_KEY(id)) ?? ''); }, [id]);
  useEffect(() => {
    if (!id) return;
    if (draft) localStorage.setItem(DRAFT_KEY(id), draft);
    else localStorage.removeItem(DRAFT_KEY(id));
  }, [id, draft]);

  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`alix-inbox-chat-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ac_messages', filter: `conversation_id=eq.${id}` }, () => load())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ac_conversations', filter: `id=eq.${id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, load]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);

  // Kundendaten (nur lesen, bestehende Strukturen — keine Duplizierung)
  useEffect(() => {
    const cid = conv?.customer_id || conv?.ac_contacts?.customer_id;
    const email = (conv?.ac_contacts as any)?.email as string | undefined;
    const phone = conv?.ac_contacts?.whatsapp_number || conv?.ac_contacts?.phone || undefined;
    if (!cid && !email && !phone) { setCustomer(null); setDevices([]); setOpenTickets(0); return; }
    (async () => {
      if (cid) {
        const { data: cu } = await (supabase as any)
          .from('customers').select('id, company_name, phone').eq('id', cid).maybeSingle();
        setCustomer(cu ?? null);
      } else setCustomer(null);

      if (email) {
        const { data: dev } = await (supabase as any)
          .from('lager_devices')
          .select('id, model_name, serial_number, device_status')
          .eq('customer_email', email).limit(10);
        setDevices(dev ?? []);
      } else setDevices([]);

      let tq = (supabase as any).from('tickets').select('id', { count: 'exact', head: true }).neq('status', 'closed');
      tq = email ? tq.eq('customer_email', email) : tq.eq('customer_phone', phone);
      const { count } = await tq;
      setOpenTickets(count ?? 0);
    })();
  }, [conv?.customer_id, conv?.ac_contacts?.customer_id, (conv?.ac_contacts as any)?.email, conv?.ac_contacts?.whatsapp_number, conv?.ac_contacts?.phone]);

  const timeline = useMemo(() => {
    const items = [
      ...messages.map((m) => ({ kind: 'msg' as const, at: m.created_at, m })),
      ...events
        .filter((e) => !['MESSAGE_RECEIVED', 'MESSAGE_SENT'].includes(e.event_type))
        .map((e) => ({ kind: 'evt' as const, at: e.created_at, e })),
    ];
    return items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }, [messages, events]);

  const openAssign = async () => {
    setAssignOpen(true);
    if (staff.length) return;
    const { data } = await (supabase as any)
      .from('user_profiles').select('id, full_name, email')
      .eq('is_active', true).order('full_name').limit(200);
    setStaff(data || []);
  };

  const guard = async (fn: () => Promise<void>, ok: string) => {
    try { await fn(); await load(); toast.success(ok); }
    catch (e: any) { toast.error(e?.message || 'Aktion fehlgeschlagen.'); }
  };

  if (loading) {
    return <div className="p-3 space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>;
  }
  if (error || !conv) {
    return (
      <Card className="m-3 p-6 text-center space-y-3">
        <div className="font-medium">Chat konnte nicht geladen werden.</div>
        <Button onClick={() => { setLoading(true); load(); }}>ERNEUT VERSUCHEN</Button>
      </Card>
    );
  }

  const prio = normPriority(conv.priority);
  const mine = !!user && conv.assigned_to === user.id;
  const canSend = windowOpen(messages);

  async function handleSend() {
    if (!conv) return;
    if (!flags?.whatsapp_outbound_enabled) {
      toast.error('WhatsApp-Versand ist deaktiviert. Nachricht wurde NICHT gesendet.');
      return;
    }
    if (!canSend) {
      toast.error('24-Stunden-Fenster geschlossen – bitte eine freigegebene Vorlage verwenden.');
      return;
    }
    const text = draft.trim();
    if (!text && !pendingFile) return;
    setSending(true);
    try {
      let media: Awaited<ReturnType<typeof uploadInboxMedia>> | null = null;
      if (pendingFile) media = await uploadInboxMedia(conv.id, pendingFile);
      await sendWhatsApp({
        conversation_id: conv.id,
        message_type: media ? media.message_type : 'TEXT',
        body: text || null,
        storage_path: media?.storage_path ?? null,
        file_name: media?.file_name ?? null,
        mime_type: media?.mime_type ?? null,
        file_size: media?.file_size ?? null,
        reply_to_message_id: replyTo?.id ?? null,
      });
      setDraft(''); setPendingFile(null); setReplyTo(null);
      localStorage.removeItem(DRAFT_KEY(conv.id));
      await load();
      toast.success('Nachricht gesendet.');
    } catch (e: any) {
      toast.error(e?.message || 'Nachricht konnte nicht gesendet werden.');
    } finally {
      setSending(false);
    }
  }


  return (
    <div className="flex flex-col min-h-[calc(100vh-9rem)]">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border p-2 space-y-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => nav('/mobil/inbox')} aria-label="Zurück">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="font-semibold truncate">{displayName(conv)}</div>
            <div className="text-[11px] text-muted-foreground truncate">
              {conv.ac_channels?.name || conv.channel_type || 'WhatsApp'}
              {conv.ac_contacts?.whatsapp_number ? ` · ${conv.ac_contacts.whatsapp_number}` : ''}
            </div>
          </div>
          <Badge variant={prio === 'P1' ? 'destructive' : 'secondary'}>{prio}</Badge>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <Select value={conv.inbox_status} onValueChange={(v) => guard(() => setStatus(conv, v as InboxStatus), 'Status geändert.')}>
            <SelectTrigger className="h-9 w-[170px] shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_ORDER.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={prio} onValueChange={(v) => guard(() => setPriority(conv, v as Priority), 'Priorität geändert.')}>
            <SelectTrigger className="h-9 w-[140px] shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRIORITY_ORDER.map((p) => <SelectItem key={p} value={p}>{p} · {PRIORITY_LABEL[p]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={conv.category ?? undefined} onValueChange={(v) => guard(() => setCategory(conv, v), 'Kategorie geändert.')}>
            <SelectTrigger className="h-9 w-[150px] shrink-0"><SelectValue placeholder="Kategorie" /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={() => setCustomerOpen(true)}>
            <User2 className="h-4 w-4 mr-1" /> KUNDE
          </Button>
          <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={openAssign}>
            <UserPlus className="h-4 w-4 mr-1" /> ZUWEISEN
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {mine ? (
            <span className="text-[11px] text-emerald-500">Sie bearbeiten diesen Chat.</span>
          ) : (
            <Button size="sm" className="h-9" onClick={() => guard(() => claimConversation(conv), 'Chat übernommen.')}>
              ÜBERNEHMEN
            </Button>
          )}
        </div>
      </div>

      <AlixAiCard
        conversationId={conv.id}
        lastMessageId={messages.length ? messages[messages.length - 1].id : null}
        onInsertDraft={(text) => setDraft(text)}
        onOpenTicket={(ticketId) => nav(`/tickets?ticket=${ticketId}`)}
        onApplyCategory={(c) => guard(() => setCategory(conv, c), 'Kategorie übernommen.')}
        onApplyPriority={(p) => guard(() => setPriority(conv, p as Priority), 'Priorität übernommen.')}
      />

      <div className="flex-1 p-3 space-y-2.5">

        {timeline.map((it) => {
          if (it.kind === 'evt') {
            return (
              <div key={`e-${it.e.id}`} className="flex justify-center py-1">
                <span className="rounded-full bg-muted/60 px-2.5 py-1 text-[10px] text-muted-foreground">
                  {it.e.event_type} · {relTime(it.at)}
                </span>
              </div>
            );
          }
          const m = it.m;
          if (m.is_internal_note || m.direction === 'internal') {
            return (
              <div key={m.id} className="rounded-xl border border-dashed border-amber-500/60 bg-amber-500/5 p-2.5">
                <div className="text-[10px] font-semibold tracking-wide text-amber-500">
                  INTERN · {m.sender_name || 'Mitarbeiter'} · {relTime(m.created_at)}
                </div>
                <div className="text-sm whitespace-pre-wrap mt-0.5">{m.body}</div>
              </div>
            );
          }
          const inbound = m.direction === 'inbound';
          return (
            <div key={m.id} className={`flex ${inbound ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-snug shadow-sm ${
                inbound
                  ? 'bg-muted text-foreground rounded-bl-md'
                  : 'bg-primary text-primary-foreground rounded-br-md'
              }`}>
                {Array.isArray(m.attachments) && m.attachments.length > 0 && (
                  <div className="mb-1.5 space-y-1">
                    {m.attachments.map((att: any, i: number) => <MediaBubble key={i} att={att} />)}
                  </div>
                )}
                {m.body && <div className="whitespace-pre-wrap break-words">{m.body}</div>}
                <div className={`text-[10px] mt-1 flex items-center gap-2 ${inbound ? 'text-muted-foreground' : 'opacity-80'}`}>
                  <span className="tabular-nums">{relTime(m.created_at)}{m.delivery_status ? ` · ${STATUS_TEXT[m.delivery_status] ?? m.delivery_status}` : ''}</span>
                  <button className="underline min-h-[24px]" onClick={() => { haptic('light'); setReplyTo(m); }}>Antworten</button>
                </div>
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      <div
        className="sticky bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur p-2 space-y-2"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}
      >
        {replyTo && (
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-2 text-xs">
            <div className="flex-1 truncate">Antwort auf: {replyTo.body || '(Anhang)'}</div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReplyTo(null)} aria-label="Antwortbezug entfernen">
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
        {pendingFile && (
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-2 text-xs">
            <Paperclip className="h-3 w-3" />
            <div className="flex-1 truncate">{pendingFile.name} · {(pendingFile.size / 1024 / 1024).toFixed(1)} MB</div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPendingFile(null)} aria-label="Anhang entfernen">
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              if (f.size > 50 * 1024 * 1024) { toast.error('Die Datei ist größer als 50 MB.'); return; }
              setPendingFile(f);
            }}
          />
          <Button
            variant="ghost" size="icon" className="h-10 w-10"
            disabled={!flags?.media_send_enabled || sending}
            onClick={() => fileRef.current?.click()}
            aria-label="Anhang"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setQuickOpen(true)} aria-label="Schnellantworten">
            <Zap className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setNoteOpen(true)} aria-label="Interne Notiz">
            <StickyNote className="h-4 w-4" />
          </Button>
          {flags?.ticket_from_chat_enabled && (
            <Button
              variant="ghost" size="icon" className="h-10 w-10"
              aria-label="Ticket erstellen"
              onClick={() => {
                setTicketForm((f) => ({
                  ...f,
                  title: conv.subject || `WhatsApp · ${displayName(conv)}`,
                  description: messages.filter((m) => m.direction === 'inbound').slice(-5)
                    .map((m) => `${new Date(m.created_at).toLocaleString('de-DE')}: ${m.body ?? '(Anhang)'}`).join('\n'),
                  category: conv.category ?? '',
                }));
                setTicketOpen(true);
              }}
            >
              <Ticket className="h-4 w-4" />
            </Button>
          )}
          <Input
            className="h-11"
            placeholder="Antwort schreiben …"
            value={draft}
            disabled={sending}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend(); } }}
          />
          <Button
            size="icon"
            className="h-11 w-11"
            disabled={sending || (!draft.trim() && !pendingFile)}
            onClick={() => void handleSend()}
            aria-label="Senden"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        {!flags?.whatsapp_outbound_enabled && (
          <div className="text-[10px] text-amber-500 text-center">
            WhatsApp-Versand ist deaktiviert (Feature-Flag whatsapp_outbound_enabled).
          </div>
        )}
        {flags?.whatsapp_outbound_enabled && !canSend && (
          <div className="text-[10px] text-amber-500 text-center">
            24-Stunden-Fenster geschlossen – es ist nur noch eine freigegebene WhatsApp-Vorlage möglich.
          </div>
        )}
      </div>

      <Dialog open={quickOpen} onOpenChange={setQuickOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Schnellantworten</DialogTitle></DialogHeader>
          <div className="space-y-1">
            {quickReplies.length === 0 && <div className="text-sm text-muted-foreground">Keine Schnellantworten hinterlegt.</div>}
            {quickReplies.map((q) => (
              <button
                key={q.id}
                className="w-full text-left p-2 rounded-md hover:bg-muted"
                onClick={() => {
                  setDraft(q.body
                    .replace(/\{\{\s*kunde\s*\}\}/gi, displayName(conv))
                    .replace(/\{\{\s*mitarbeiter\s*\}\}/gi, (user as any)?.user_metadata?.full_name ?? ''));
                  setQuickOpen(false);
                }}
              >
                <div className="text-sm font-medium">{q.title}</div>
                <div className="text-[11px] text-muted-foreground line-clamp-2">{q.body}</div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={ticketOpen} onOpenChange={setTicketOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Ticket aus Chat erstellen</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Input placeholder="Titel" value={ticketForm.title} onChange={(e) => setTicketForm({ ...ticketForm, title: e.target.value })} />
            <Textarea rows={5} placeholder="Beschreibung" value={ticketForm.description} onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })} />
            <Select value={ticketForm.department} onValueChange={(v) => setTicketForm({ ...ticketForm, department: v })}>
              <SelectTrigger className="h-10"><SelectValue placeholder="Abteilung" /></SelectTrigger>
              <SelectContent>
                {['SERVICE', 'TECHNIK', 'VERTRIEB', 'BUCHHALTUNG', 'LOGISTIK'].map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={ticketForm.priority} onValueChange={(v) => setTicketForm({ ...ticketForm, priority: v })}>
              <SelectTrigger className="h-10"><SelectValue placeholder="Priorität" /></SelectTrigger>
              <SelectContent>
                {['urgent', 'high', 'normal', 'low'].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            {linkedTickets.length > 0 && (
              <div className="text-[11px] text-muted-foreground">
                Bereits verknüpft: {linkedTickets.map((t: any) => t.tickets?.ticket_number ?? t.tickets?.case_number ?? t.ticket_id).join(', ')}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTicketOpen(false)}>Abbrechen</Button>
            <Button
              disabled={!ticketForm.title.trim() || ticketBusy}
              onClick={async () => {
                setTicketBusy(true);
                try {
                  const t = await createTicketFromChat({
                    conv,
                    title: ticketForm.title.trim(),
                    description: ticketForm.description.trim(),
                    department: ticketForm.department,
                    priority: ticketForm.priority,
                    category: ticketForm.category || null,
                    deviceId: devices[0]?.id ?? null,
                  });
                  toast.success(`Ticket ${t.ticket_number ?? t.case_number ?? ''} erstellt.`);
                  setTicketOpen(false);
                  const [ev, lt] = await Promise.all([fetchEvents(conv.id), fetchLinkedTickets(conv.id)]);
                  setEvents(ev); setLinkedTickets(lt);
                } catch (e: any) {
                  toast.error(e?.message || 'Ticket konnte nicht erstellt werden.');
                } finally { setTicketBusy(false); }
              }}
            >{ticketBusy ? 'Wird erstellt …' : 'Ticket erstellen'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Interne Notiz</DialogTitle></DialogHeader>
          <Textarea rows={5} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Nur intern sichtbar – wird nie an den Kunden gesendet." />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNoteOpen(false)}>Abbrechen</Button>
            <Button
              disabled={!noteText.trim()}
              onClick={async () => {
                await guard(() => addInternalNote(conv.id, noteText.trim()), 'Notiz gespeichert.');
                setNoteText(''); setNoteOpen(false);
              }}
            >Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Chat zuweisen</DialogTitle></DialogHeader>
          <Input placeholder="Mitarbeiter suchen …" value={staffSearch} onChange={(e) => setStaffSearch(e.target.value)} />
          <div className="space-y-1">
            {staff
              .filter((s) => `${s.full_name ?? ''} ${s.email ?? ''}`.toLowerCase().includes(staffSearch.toLowerCase()))
              .slice(0, 50)
              .map((s) => (
                <button
                  key={s.id}
                  className="w-full text-left p-2 rounded-md hover:bg-muted"
                  onClick={async () => {
                    await guard(() => assignConversation(conv, s.id), 'Chat zugewiesen.');
                    setAssignOpen(false);
                  }}
                >
                  <div className="text-sm font-medium">{s.full_name || s.email}</div>
                  <div className="text-[11px] text-muted-foreground">{s.email}</div>
                </button>
              ))}
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={customerOpen} onOpenChange={setCustomerOpen}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          <SheetHeader><SheetTitle>Kunde</SheetTitle></SheetHeader>
          <div className="space-y-3 pt-2 text-sm">
            {!customer && devices.length === 0 && (
              <div className="space-y-2">
                <div className="text-muted-foreground">Unbekannter Kontakt</div>
                <div className="text-xs">{conv.ac_contacts?.whatsapp_number || conv.external_thread_id}</div>
                <Button variant="outline" onClick={() => nav('/mobil/suche')}>KUNDE ZUORDNEN</Button>
              </div>
            )}
            {customer && (
              <>
                <div className="font-semibold">{customer.company_name}</div>
                {customer.phone && <div className="text-muted-foreground">{customer.phone}</div>}
                {devices.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs uppercase text-muted-foreground">Geräte</div>
                    {devices.map((d) => (
                      <Card key={d.id} className="p-2 text-xs">
                        <div className="font-medium">{d.model_name || 'Gerät'}</div>
                        <div className="text-muted-foreground">SN {d.serial_number || '—'} · {d.device_status || '—'}</div>
                      </Card>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-xs">Offene Tickets: {openTickets}</span>
                  <Button size="sm" variant="outline" onClick={() => nav('/tickets')}>TICKETS</Button>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
