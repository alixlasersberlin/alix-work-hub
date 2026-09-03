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
import { ArrowLeft, Send, Paperclip, StickyNote, User2, UserPlus } from 'lucide-react';
import {
  fetchMessages, fetchEvents, markRead, addInternalNote, claimConversation,
  assignConversation, setStatus, setPriority, setCategory, displayName, relTime,
  normPriority, PRIORITY_LABEL, PRIORITY_ORDER, STATUS_LABEL, STATUS_ORDER, CATEGORIES,
  type ConversationRow, type MessageRow, type InboxStatus, type Priority,
} from '@/lib/inbox/api';

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

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setError(false);
      const { data, error: cErr } = await (supabase as any)
        .from('ac_conversations')
        .select(`id, channel_id, channel_type, customer_id, contact_id, assigned_to, assigned_department,
                 inbox_status, priority, category, subject, last_message_at, last_message_preview,
                 unread_count, customer_match_required, is_test, external_thread_id,
                 ac_contacts:contact_id ( full_name, phone, whatsapp_number, customer_id ),
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
    if (!id) return;
    const ch = supabase
      .channel(`alix-inbox-chat-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ac_messages', filter: `conversation_id=eq.${id}` }, () => load())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ac_conversations', filter: `id=eq.${id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, load]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);

  // Kundendaten (nur lesen, bestehende Strukturen)
  useEffect(() => {
    const cid = conv?.customer_id || conv?.ac_contacts?.customer_id;
    if (!cid) { setCustomer(null); setDevices([]); setOpenTickets(0); return; }
    (async () => {
      const [{ data: cu }, { data: dev }, { count }] = await Promise.all([
        (supabase as any).from('customers').select('id, company_name, phone').eq('id', cid).maybeSingle(),
        (supabase as any).from('lager_devices').select('id, model, serial_number, status').eq('customer_id', cid).limit(10),
        (supabase as any).from('tickets').select('id', { count: 'exact', head: true }).eq('customer_id', cid).neq('status', 'closed'),
      ]);
      setCustomer(cu ?? null);
      setDevices(dev ?? []);
      setOpenTickets(count ?? 0);
    })();
  }, [conv?.customer_id, conv?.ac_contacts?.customer_id]);

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

      <div className="flex-1 p-3 space-y-2">
        {timeline.map((it) => {
          if (it.kind === 'evt') {
            return (
              <div key={`e-${it.e.id}`} className="text-center text-[10px] text-muted-foreground py-1">
                {it.e.event_type} · {relTime(it.at)}
              </div>
            );
          }
          const m = it.m;
          if (m.is_internal_note || m.direction === 'internal') {
            return (
              <div key={m.id} className="rounded-lg border border-dashed border-amber-500/60 bg-amber-500/5 p-2">
                <div className="text-[10px] font-semibold text-amber-500">
                  INTERN · {m.sender_name || 'Mitarbeiter'} · {relTime(m.created_at)}
                </div>
                <div className="text-sm whitespace-pre-wrap">{m.body}</div>
              </div>
            );
          }
          const inbound = m.direction === 'inbound';
          return (
            <div key={m.id} className={`flex ${inbound ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                inbound ? 'bg-muted rounded-bl-sm' : 'bg-primary text-primary-foreground rounded-br-sm'
              }`}>
                <div className="whitespace-pre-wrap break-words">{m.body || '—'}</div>
                <div className={`text-[10px] mt-0.5 ${inbound ? 'text-muted-foreground' : 'opacity-80'}`}>
                  {relTime(m.created_at)}{m.delivery_status ? ` · ${m.delivery_status}` : ''}
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
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-10 w-10" disabled title="Anhänge folgen in Prompt 3">
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setNoteOpen(true)} aria-label="Interne Notiz">
            <StickyNote className="h-4 w-4" />
          </Button>
          <Input
            className="h-11"
            placeholder="Antwort schreiben …"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <Button
            size="icon"
            className="h-11 w-11"
            onClick={() => toast.warning('WhatsApp-Versand ist noch nicht aktiviert (Testmodus). Nachricht wurde NICHT gesendet.')}
            aria-label="Senden"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <div className="text-[10px] text-muted-foreground text-center">
          Testmodus: Ausgehender WhatsApp-Versand folgt in einem späteren Schritt.
        </div>
      </div>

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
            {!customer && (
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
                        <div className="font-medium">{d.model || 'Gerät'}</div>
                        <div className="text-muted-foreground">SN {d.serial_number || '—'} · {d.status || '—'}</div>
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
