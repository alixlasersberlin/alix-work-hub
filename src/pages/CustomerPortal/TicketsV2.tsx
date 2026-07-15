import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Loader2, LifeBuoy, Plus, Send } from 'lucide-react';
import { toast } from 'sonner';
import { logPortalAudit } from '@/lib/portal/audit';

type Ctx = { customerId: string; companyName: string | null; email: string | null };

type Ticket = {
  id: string;
  subject: string;
  category: string | null;
  status: string;
  priority: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
};

type Message = {
  id: string;
  ticket_id: string;
  from_role: string;
  message: string;
  created_at: string;
};

const CATEGORIES = [
  { v: 'general', l: 'Allgemeine Anfrage' },
  { v: 'invoice', l: 'Rechnung' },
  { v: 'device', l: 'Gerät / Wartung' },
  { v: 'contract', l: 'Vertrag' },
  { v: 'data_change_request', l: 'Stammdaten-Änderung' },
];

const RATE_LIMIT_PER_HOUR = 5;

export default function CustomerPortalTicketsV2() {
  const ctx = useOutletContext<Ctx>();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);

  const reload = async () => {
    const { data } = await supabase
      .from('customer_portal_tickets')
      .select('id, subject, category, status, priority, created_at, updated_at, closed_at')
      .order('updated_at', { ascending: false });
    setTickets((data ?? []) as Ticket[]);
    setLoading(false);
  };

  useEffect(() => { void reload(); void logPortalAudit({ action: 'ticket_viewed', customerId: ctx.customerId }); }, [ctx.customerId]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2"><LifeBuoy className="w-5 h-5" /> Meine Tickets</h2>
          <p className="text-muted-foreground text-sm">Anfragen an Alix Lasers — Antworten unseres Teams erscheinen hier.</p>
        </div>
        <NewTicketDialog customerId={ctx.customerId} onCreated={reload} existingCount1h={tickets.filter((t) => Date.now() - new Date(t.created_at).getTime() < 3600_000).length} />
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : tickets.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Noch keine Tickets. Über „Neues Ticket" oben rechts können Sie eine Anfrage stellen.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => (
            <Card key={t.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setSelected(t)}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{t.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString('de-DE')} · {CATEGORIES.find((c) => c.v === t.category)?.l ?? t.category ?? '—'}
                  </p>
                </div>
                <StatusBadge status={t.status} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <TicketDetail
          ticket={selected}
          customerId={ctx.customerId}
          onClose={() => setSelected(null)}
          onChanged={reload}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant = status === 'closed' ? 'outline' : status === 'in_progress' ? 'default' : 'secondary';
  const label = status === 'open' ? 'Offen' : status === 'in_progress' ? 'In Bearbeitung' : status === 'closed' ? 'Geschlossen' : status;
  return <Badge variant={variant as any}>{label}</Badge>;
}

function NewTicketDialog({ customerId, onCreated, existingCount1h }: { customerId: string; onCreated: () => void; existingCount1h: number }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('general');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!subject.trim() || !message.trim()) { toast.error('Bitte Betreff und Nachricht ausfüllen.'); return; }
    if (existingCount1h >= RATE_LIMIT_PER_HOUR) {
      toast.error('Zu viele neue Tickets in kurzer Zeit. Bitte in einer Stunde erneut versuchen.');
      void logPortalAudit({ action: 'ticket_rate_limited', customerId, success: false });
      return;
    }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Nicht angemeldet.'); setBusy(false); return; }
    const { data: t, error } = await supabase
      .from('customer_portal_tickets')
      .insert({ customer_id: customerId, subject: subject.trim(), category, status: 'open', priority: 'normal', created_by: user.id })
      .select('id')
      .single();
    if (error || !t) { toast.error(error?.message ?? 'Ticket konnte nicht angelegt werden.'); setBusy(false); return; }
    const { error: mErr } = await supabase
      .from('customer_portal_ticket_messages')
      .insert({ ticket_id: t.id, from_role: 'customer', author_id: user.id, message: message.trim() });
    if (mErr) { toast.error(mErr.message); setBusy(false); return; }
    void logPortalAudit({ action: 'ticket_created', customerId, objectType: 'ticket', objectId: t.id });
    toast.success('Ticket angelegt. Wir melden uns zeitnah.');
    setSubject(''); setMessage(''); setCategory('general');
    setOpen(false); setBusy(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> Neues Ticket</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Neues Ticket</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Kategorie</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Betreff</label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Nachricht</label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={4000} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Abbrechen</Button>
          <Button onClick={submit} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Absenden'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TicketDetail({ ticket, customerId, onClose, onChanged }: { ticket: Ticket; customerId: string; onClose: () => void; onChanged: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('customer_portal_ticket_messages')
        .select('id, ticket_id, from_role, message, created_at')
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: true });
      setMessages((data ?? []) as Message[]);
      setLoading(false);
    })();
  }, [ticket.id]);

  const send = async () => {
    if (!reply.trim()) return;
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return; }
    const { error } = await supabase.from('customer_portal_ticket_messages').insert({
      ticket_id: ticket.id, from_role: 'customer', author_id: user.id, message: reply.trim(),
    });
    if (error) { toast.error(error.message); setBusy(false); return; }
    // Ticket wieder auf offen setzen falls geschlossen? Nur updated_at anfassen.
    await supabase.from('customer_portal_tickets').update({ updated_at: new Date().toISOString() }).eq('id', ticket.id);
    void logPortalAudit({ action: 'ticket_replied', customerId, objectType: 'ticket', objectId: ticket.id });
    setReply(''); setBusy(false);
    const { data } = await supabase.from('customer_portal_ticket_messages').select('id, ticket_id, from_role, message, created_at').eq('ticket_id', ticket.id).order('created_at', { ascending: true });
    setMessages((data ?? []) as Message[]);
    onChanged();
  };

  const close = async () => {
    setBusy(true);
    const { error } = await supabase.from('customer_portal_tickets').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', ticket.id);
    if (error) { toast.error(error.message); setBusy(false); return; }
    void logPortalAudit({ action: 'ticket_closed', customerId, objectType: 'ticket', objectId: ticket.id });
    toast.success('Ticket geschlossen.');
    setBusy(false);
    onChanged();
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3 pr-6">
            <span className="truncate">{ticket.subject}</span>
            <StatusBadge status={ticket.status} />
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[50vh] overflow-y-auto">
          {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : messages.map((m) => (
            <div key={m.id} className={`p-3 rounded-md text-sm ${m.from_role === 'customer' ? 'bg-primary/10 ml-6' : 'bg-muted mr-6'}`}>
              <p className="text-xs text-muted-foreground mb-1">
                {m.from_role === 'customer' ? 'Sie' : 'Alix Lasers'} · {new Date(m.created_at).toLocaleString('de-DE')}
              </p>
              <p className="whitespace-pre-wrap">{m.message}</p>
            </div>
          ))}
        </div>
        {ticket.status !== 'closed' && (
          <div className="space-y-2 border-t pt-3">
            <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Antwort schreiben…" rows={3} maxLength={4000} />
            <div className="flex justify-between gap-2">
              <Button variant="outline" size="sm" onClick={close} disabled={busy}>Ticket schließen</Button>
              <Button size="sm" onClick={send} disabled={busy || !reply.trim()}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-1" /> Senden</>}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
