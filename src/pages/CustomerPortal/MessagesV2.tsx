import { useEffect, useMemo, useState } from 'react';
import { useOutletContext, useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MessagesSquare, Loader2, Send, Plus, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { logPortalAudit } from '@/lib/portal/audit';

type Ctx = { customerId: string; refreshBadges: () => void };
const DEPARTMENTS = [
  { v: 'service', l: 'Service' }, { v: 'accounting', l: 'Buchhaltung' },
  { v: 'sales', l: 'Vertrieb' }, { v: 'contracts', l: 'Vertragsabteilung' },
  { v: 'training', l: 'Schulung' }, { v: 'privacy', l: 'Datenschutz' },
];

export default function CustomerPortalMessages() {
  const { id } = useParams();
  const ctx = useOutletContext<Ctx>();
  if (id) return <ThreadView threadId={id} ctx={ctx} />;
  return <ThreadList ctx={ctx} />;
}

function ThreadList({ ctx }: { ctx: Ctx }) {
  const [threads, setThreads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [dept, setDept] = useState('service');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('customer_portal_message_threads')
      .select('id, department, subject, status, last_message_at, archived_by_customer, customer_portal_messages(id, from_role, read_at)')
      .eq('customer_id', ctx.customerId).eq('archived_by_customer', false)
      .order('last_message_at', { ascending: false });
    setThreads(data ?? []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, [ctx.customerId]);

  const createThread = async () => {
    if (!subject.trim() || !body.trim()) return toast.error('Bitte Betreff und Nachricht ausfüllen.');
    setBusy(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Nicht angemeldet');
      const { data: th, error } = await supabase.from('customer_portal_message_threads').insert({
        customer_id: ctx.customerId, department: dept, subject: subject.trim(), created_by: user.user.id,
      }).select('id').single();
      if (error) throw error;
      const { error: msgErr } = await supabase.from('customer_portal_messages').insert({
        thread_id: th.id, customer_id: ctx.customerId, from_role: 'customer', author_id: user.user.id, body: body.trim(),
      });
      if (msgErr) throw msgErr;
      void logPortalAudit({ action: 'data_change_requested', customerId: ctx.customerId, objectType: 'message_thread', objectId: th.id });
      toast.success('Nachricht gesendet.');
      setOpen(false); setSubject(''); setBody(''); await load(); ctx.refreshBadges?.();
    } catch (e: any) { toast.error(e?.message ?? 'Senden fehlgeschlagen'); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><MessagesSquare className="w-5 h-5" /><h2 className="text-2xl font-semibold">Sichere Nachrichten</h2></div>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" />Neue Nachricht</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {threads.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">Noch keine Konversationen.</p>
          ) : (
            <ul className="divide-y divide-border">
              {threads.map((t) => {
                const msgs = t.customer_portal_messages ?? [];
                const unread = msgs.filter((m: any) => m.from_role === 'staff' && !m.read_at).length;
                return (
                  <li key={t.id}>
                    <Link to={`/kunde/nachrichten/${t.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-muted/40 transition">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{t.subject}</p>
                        <p className="text-xs text-muted-foreground">{DEPARTMENTS.find((d) => d.v === t.department)?.l ?? t.department} · {new Date(t.last_message_at).toLocaleString('de-DE')}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {unread > 0 && <Badge>{unread} neu</Badge>}
                        <Badge variant="outline">{t.status}</Badge>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Neue Nachricht</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Abteilung</Label>
              <Select value={dept} onValueChange={setDept}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d.v} value={d.v}>{d.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Betreff *</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} /></div>
            <div><Label>Nachricht *</Label><Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Abbrechen</Button>
            <Button onClick={createThread} disabled={busy}>{busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}<Send className="w-4 h-4 mr-1" />Senden</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ThreadView({ threadId, ctx }: { threadId: string; ctx: Ctx }) {
  const [thread, setThread] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [t, m] = await Promise.all([
      supabase.from('customer_portal_message_threads').select('*').eq('id', threadId).maybeSingle(),
      supabase.from('customer_portal_messages').select('*').eq('thread_id', threadId).order('created_at', { ascending: true }),
    ]);
    setThread(t.data); setMessages(m.data ?? []); setLoading(false);
    // Ungelesene Staff-Nachrichten als gelesen markieren
    const unreadIds = (m.data ?? []).filter((x: any) => x.from_role === 'staff' && !x.read_at).map((x: any) => x.id);
    if (unreadIds.length) {
      await supabase.from('customer_portal_messages').update({ read_at: new Date().toISOString() }).in('id', unreadIds);
      ctx.refreshBadges?.();
    }
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [threadId]);

  const send = async () => {
    if (!reply.trim()) return;
    setBusy(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Nicht angemeldet');
      const { error } = await supabase.from('customer_portal_messages').insert({
        thread_id: threadId, customer_id: ctx.customerId, from_role: 'customer',
        author_id: user.user.id, body: reply.trim(),
      });
      if (error) throw error;
      await supabase.from('customer_portal_message_threads').update({ last_message_at: new Date().toISOString() }).eq('id', threadId);
      setReply(''); await load();
    } catch (e: any) { toast.error(e?.message ?? 'Senden fehlgeschlagen'); }
    finally { setBusy(false); }
  };

  const deptLabel = useMemo(() => DEPARTMENTS.find((d) => d.v === thread?.department)?.l, [thread]);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (!thread) return <p className="text-center py-10 text-muted-foreground">Konversation nicht gefunden.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm"><Link to="/kunde/nachrichten"><ArrowLeft className="w-4 h-4 mr-1" />Zurück</Link></Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between gap-2">
            <span>{thread.subject}</span>
            <Badge variant="outline">{deptLabel}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {messages.map((m) => (
            <div key={m.id} className={`p-3 rounded-md text-sm ${m.from_role === 'customer' ? 'bg-primary/10 ml-6' : 'bg-muted/40 mr-6'}`}>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                {m.from_role === 'customer' ? 'Sie' : 'Alix Lasers'} · {new Date(m.created_at).toLocaleString('de-DE')}
              </p>
              <p className="whitespace-pre-wrap">{m.body}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 space-y-2">
          <Textarea rows={4} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Ihre Antwort …" maxLength={4000} />
          <div className="flex justify-end">
            <Button size="sm" onClick={send} disabled={busy || !reply.trim()}>{busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}<Send className="w-4 h-4 mr-1" />Antworten</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
