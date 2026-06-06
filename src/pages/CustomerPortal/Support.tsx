import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LifeBuoy, Send, Loader2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

type Ctx = { customerId: string };

export default function CustomerPortalSupport() {
  const ctx = useOutletContext<Ctx>();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('Allgemein');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [openTicket, setOpenTicket] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [reply, setReply] = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('customer_portal_tickets')
      .select('*')
      .eq('customer_id', ctx.customerId)
      .order('created_at', { ascending: false });
    setTickets(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [ctx.customerId]);

  const createTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return toast.error('Betreff und Nachricht erforderlich');
    setSubmitting(true);
    const { data: t, error } = await supabase.from('customer_portal_tickets').insert({
      customer_id: ctx.customerId, subject, category, status: 'open',
    }).select().single();
    if (error || !t) { setSubmitting(false); return toast.error(error?.message ?? 'Fehler'); }
    await supabase.from('customer_portal_ticket_messages').insert({
      ticket_id: t.id, from_role: 'customer', message,
    });
    setSubmitting(false);
    setSubject(''); setMessage(''); setCategory('Allgemein');
    toast.success('Ticket erstellt');
    load();
  };

  const openConversation = async (t: any) => {
    setOpenTicket(t);
    const { data } = await supabase
      .from('customer_portal_ticket_messages').select('*').eq('ticket_id', t.id).order('created_at');
    setMessages(data ?? []);
  };

  const sendReply = async () => {
    if (!openTicket || !reply.trim()) return;
    const { error } = await supabase.from('customer_portal_ticket_messages').insert({
      ticket_id: openTicket.id, from_role: 'customer', message: reply,
    });
    if (error) return toast.error(error.message);
    setReply('');
    openConversation(openTicket);
  };

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><LifeBuoy className="w-5 h-5" /> Neues Ticket</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={createTicket} className="space-y-3">
            <Input placeholder="Betreff" value={subject} onChange={(e) => setSubject(e.target.value)} />
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['Allgemein','Technik','Reparatur','Rechnung','Schulung','Sonstiges'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Textarea rows={6} placeholder="Ihre Nachricht..." value={message} onChange={(e) => setMessage(e.target.value)} />
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Ticket senden
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="w-5 h-5" /> Ihre Tickets</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : tickets.length === 0 ? (
            <p className="text-center py-10 text-muted-foreground">Noch keine Tickets.</p>
          ) : (
            <div className="space-y-2">
              {tickets.map((t) => (
                <button key={t.id} onClick={() => openConversation(t)}
                  className="w-full text-left p-3 border border-border rounded-md hover:border-primary transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium truncate">{t.subject}</p>
                    <Badge>{t.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t.category} · {new Date(t.created_at).toLocaleString('de-DE')}
                  </p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {openTicket && (
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle>{openTicket.subject}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setOpenTicket(null)}>Schließen</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {messages.map((m) => (
                <div key={m.id} className={m.from_role === 'customer' ? 'text-right' : 'text-left'}>
                  <div className={`inline-block max-w-[80%] p-3 rounded-md text-sm ${m.from_role === 'customer' ? 'bg-primary/10' : 'bg-muted/40'}`}>
                    <p className="whitespace-pre-wrap">{m.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {m.from_role === 'customer' ? 'Sie' : 'Alix Lasers'} · {new Date(m.created_at).toLocaleString('de-DE')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {openTicket.status !== 'closed' && (
              <div className="flex gap-2">
                <Textarea rows={2} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Antwort schreiben..." />
                <Button onClick={sendReply}><Send className="w-4 h-4" /></Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
