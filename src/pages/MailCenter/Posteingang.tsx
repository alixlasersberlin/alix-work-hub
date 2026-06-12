import { useEffect, useMemo, useState } from 'react';
import { sanitizeHtml } from '@/lib/sanitize-html';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Inbox, RefreshCw, Mail, ExternalLink, StickyNote, UserCog, Send,
} from 'lucide-react';

const MAILBOX_LABEL: Record<string, string> = {
  finance: 'Finance', vertrieb: 'Vertrieb', service: 'Service',
  marketing: 'Marketing', personal: 'Persönlich',
};

const PRIORITY_COLORS: Record<string, string> = {
  'Niedrig': 'bg-muted text-muted-foreground',
  'Normal': 'bg-blue-500/15 text-blue-500',
  'Hoch': 'bg-amber-500/15 text-amber-500',
  'Kritisch': 'bg-destructive/15 text-destructive',
};

const FILTERS = [
  { value: 'all', label: 'Alle' },
  { value: 'unread', label: 'Ungelesen' },
  { value: 'today', label: 'Heute' },
  { value: 'week', label: 'Diese Woche' },
  { value: 'with_customer', label: 'Mit Kunde' },
  { value: 'with_order', label: 'Mit Auftrag' },
];

export default function MailCenterPosteingang() {
  const { isAdmin, hasRole } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialId = params.get('id');

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [mailbox, setMailbox] = useState<string>('all');
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [related, setRelated] = useState<{ orders: any[]; repairs: any[] }>({ orders: [], repairs: [] });

  const allowedMailboxes = useMemo(() => {
    if (isAdmin || hasRole('Geschäftsführung')) {
      return ['finance', 'vertrieb', 'service', 'marketing', 'personal'];
    }
    const arr: string[] = ['personal'];
    if (hasRole('Finance')) arr.push('finance');
    if (hasRole('Vertrieb') || hasRole('Order')) arr.push('vertrieb');
    if (hasRole('Technik') || hasRole('Kundenservice') || hasRole('Reparaturannahme')) arr.push('service');
    if (hasRole('Marketing')) arr.push('marketing');
    return Array.from(new Set(arr));
  }, [isAdmin, hasRole]);

  const load = async () => {
    setLoading(true);
    let q = supabase.from('mail_messages')
      .select('id,subject,from_email,from_name,to_email,customer_id,order_id,repair_id,invoice_id,ticket_id,status,direction,mailbox,is_read,assigned_to,priority,due_date,body_html,body_text,sent_at,created_at,customers(company_name,contact_name,email,id)')
      .eq('direction', 'inbound')
      .order('sent_at', { ascending: false })
      .limit(300);
    if (mailbox !== 'all') q = q.eq('mailbox', mailbox);
    else q = q.in('mailbox', allowedMailboxes);
    const { data } = await q;
    setRows(data ?? []);
    setLoading(false);
  };

  const loadUsers = async () => {
    const { data } = await supabase.from('user_profiles')
      .select('id, email, full_name').eq('is_active', true).order('full_name');
    setUsers(data ?? []);
  };

  useEffect(() => { loadUsers(); }, []);
  useEffect(() => { load(); /* eslint-disable-line */ }, [mailbox, allowedMailboxes.join(',')]);

  useEffect(() => {
    if (!initialId || rows.length === 0) return;
    const m = rows.find(r => r.id === initialId);
    if (m) openDetail(m);
    // eslint-disable-next-line
  }, [initialId, rows]);

  const openDetail = async (m: any) => {
    setSelected(m);
    if (!m.is_read) {
      await supabase.from('mail_messages').update({ is_read: true }).eq('id', m.id);
      setRows(prev => prev.map(r => r.id === m.id ? { ...r, is_read: true } : r));
    }
    // Notes
    const { data: ns } = await supabase.from('mail_notes')
      .select('*').eq('message_id', m.id).order('created_at');
    setNotes(ns ?? []);
    // Related records by customer
    if (m.customer_id) {
      const [{ data: ords }, { data: reps }] = await Promise.all([
        supabase.from('orders').select('id,order_number,order_status').eq('customer_id', m.customer_id).limit(20),
        supabase.from('repair_orders').select('id,repair_number,repair_status').eq('customer_id', m.customer_id).limit(20),
      ]);
      setRelated({ orders: ords ?? [], repairs: reps ?? [] });
    } else {
      setRelated({ orders: [], repairs: [] });
    }
  };

  const updateMessage = async (patch: any) => {
    if (!selected) return;
    await supabase.from('mail_messages').update(patch).eq('id', selected.id);
    setSelected({ ...selected, ...patch });
    setRows(prev => prev.map(r => r.id === selected.id ? { ...r, ...patch } : r));
    // notify assignee
    if (patch.assigned_to && patch.assigned_to !== selected.assigned_to) {
      await supabase.from('mail_notifications').insert({
        user_id: patch.assigned_to,
        type: 'assignment',
        title: 'Neue Zuweisung',
        body: selected.subject ?? '(ohne Betreff)',
        link: `/mailcenter/posteingang?id=${selected.id}`,
      });
    }
  };

  const addNote = async () => {
    if (!newNote.trim() || !selected) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase.from('mail_notes').insert({
      message_id: selected.id,
      customer_id: selected.customer_id,
      body: newNote, created_by: user?.id,
    }).select().single();
    if (data) setNotes([...notes, data]);
    setNewNote('');
  };

  const filtered = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    return rows.filter(r => {
      if (filter === 'unread' && r.is_read) return false;
      if (filter === 'today' && new Date(r.sent_at ?? r.created_at) < startOfDay) return false;
      if (filter === 'week' && new Date(r.sent_at ?? r.created_at) < startOfWeek) return false;
      if (filter === 'with_customer' && !r.customer_id) return false;
      if (filter === 'with_order' && !r.order_id) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!(`${r.subject ?? ''} ${r.from_email ?? ''} ${r.from_name ?? ''}`.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [rows, filter, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-display font-semibold text-foreground">Posteingang</h2>
          <p className="text-sm text-muted-foreground">Eingehende E-Mails aller Abteilungs-Postfächer.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-4 h-4 mr-2" /> Aktualisieren
        </Button>
      </div>

      <Card className="card-glow">
        <CardContent className="pt-6 space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <Select value={mailbox} onValueChange={setMailbox}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Postfächer</SelectItem>
                {allowedMailboxes.map(m => (
                  <SelectItem key={m} value={m}>{MAILBOX_LABEL[m] ?? m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FILTERS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Suche…" value={search} onChange={e => setSearch(e.target.value)}
              className="max-w-sm" />
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Lade…</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Inbox className="w-10 h-10 opacity-40 mb-3" />
              <p className="text-sm">Keine eingehenden E-Mails.</p>
              <p className="text-xs mt-2 max-w-md text-center">
                Eingehende Mails erscheinen hier, sobald der Inbound-Webhook (`inbound-mail`)
                bei Resend hinterlegt ist.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Absender</TableHead>
                    <TableHead>Betreff</TableHead>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Postfach</TableHead>
                    <TableHead>Priorität</TableHead>
                    <TableHead>Zuständig</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(r => (
                    <TableRow key={r.id} onClick={() => openDetail(r)}
                      className={`cursor-pointer ${!r.is_read ? 'font-semibold' : ''}`}>
                      <TableCell className="text-xs">
                        {new Date(r.sent_at ?? r.created_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
                      </TableCell>
                      <TableCell className="text-xs">{r.from_name ?? r.from_email}</TableCell>
                      <TableCell className="text-xs max-w-[280px] truncate">{r.subject ?? '—'}</TableCell>
                      <TableCell className="text-xs">{r.customers?.company_name ?? r.customers?.contact_name ?? '—'}</TableCell>
                      <TableCell><Badge variant="outline">{MAILBOX_LABEL[r.mailbox] ?? '—'}</Badge></TableCell>
                      <TableCell>
                        <Badge variant="outline" className={PRIORITY_COLORS[r.priority ?? 'Normal']}>
                          {r.priority ?? 'Normal'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {users.find(u => u.id === r.assigned_to)?.full_name ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" /> {selected?.subject}
            </DialogTitle>
            <DialogDescription>
              {selected?.from_name ?? ''} &lt;{selected?.from_email}&gt; → {selected?.to_email}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2 space-y-3">
                <div className="rounded border border-border p-3 max-h-72 overflow-y-auto bg-background">
                  {selected.body_html
                    ? <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(selected.body_html) }} />
                    : <pre className="text-xs whitespace-pre-wrap">{selected.body_text}</pre>}
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <StickyNote className="w-4 h-4" /> Interne Notizen
                  </h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {notes.map(n => (
                      <div key={n.id} className="text-xs p-2 rounded bg-muted/40">
                        <p>{n.body}</p>
                        <p className="text-muted-foreground mt-1">
                          {new Date(n.created_at).toLocaleString('de-DE')}
                        </p>
                      </div>
                    ))}
                    {notes.length === 0 && <p className="text-xs text-muted-foreground">Noch keine Notizen.</p>}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Textarea value={newNote} onChange={e => setNewNote(e.target.value)}
                      placeholder="Interne Notiz…" rows={2} />
                    <Button onClick={addNote}>Hinzufügen</Button>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded border border-border p-3 space-y-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <UserCog className="w-4 h-4" /> Zuweisung
                  </h3>
                  <Label className="text-xs">Zuständig</Label>
                  <Select value={selected.assigned_to ?? '__none__'}
                    onValueChange={v => updateMessage({ assigned_to: v === '__none__' ? null : v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Nicht zugewiesen</SelectItem>
                      {users.map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.full_name ?? u.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Label className="text-xs">Priorität</Label>
                  <Select value={selected.priority ?? 'Normal'}
                    onValueChange={v => updateMessage({ priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['Niedrig', 'Normal', 'Hoch', 'Kritisch'].map(p => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Label className="text-xs">Fälligkeit</Label>
                  <Input type="date"
                    value={selected.due_date ? String(selected.due_date).slice(0, 10) : ''}
                    onChange={e => updateMessage({ due_date: e.target.value || null })} />
                </div>

                {(related.orders.length > 0 || related.repairs.length > 0) && (
                  <div className="rounded border border-border p-3 space-y-2">
                    <h3 className="text-sm font-semibold">Verknüpfte Vorgänge</h3>
                    {related.orders.map(o => (
                      <button key={o.id}
                        onClick={() => navigate(`/auftraege/${o.id}`)}
                        className="block text-xs text-primary hover:underline w-full text-left">
                        Auftrag {o.order_number} • {o.order_status}
                      </button>
                    ))}
                    {related.repairs.map(r => (
                      <div key={r.id} className="text-xs">
                        Reparatur {r.repair_number} • {r.repair_status}
                      </div>
                    ))}
                  </div>
                )}

                {selected.customer_id && (
                  <Button variant="outline" size="sm" className="w-full"
                    onClick={() => navigate(`/kunden/${selected.customer_id}`)}>
                    <ExternalLink className="w-4 h-4 mr-2" /> Kunde öffnen
                  </Button>
                )}
                <Button className="w-full" onClick={() => {
                  navigate('/mailcenter/schreiben', {
                    state: {
                      replyTo: selected.from_email,
                      subject: `Re: ${selected.subject ?? ''}`,
                      customer: selected.customers,
                    },
                  });
                }}>
                  <Send className="w-4 h-4 mr-2" /> Antworten
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Schließen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
