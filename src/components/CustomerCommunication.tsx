import { useEffect, useMemo, useState } from 'react';
import { sanitizeHtml } from '@/lib/sanitize-html';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquare, Mail, Send, Search, Loader2, Inbox, RotateCw, Plus, ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

type MailMessage = {
  id: string;
  customer_id: string | null;
  order_id: string | null;
  invoice_id: string | null;
  repair_id: string | null;
  template_id: string | null;
  to_email: string | null;
  to_name: string | null;
  from_email: string | null;
  from_name: string | null;
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  status: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  created_at: string;
};

type MailEvent = {
  id: string;
  message_id: string;
  event_type: string;
  event_data: any;
  created_at: string;
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  draft:        { label: 'Entwurf',      className: 'bg-muted text-muted-foreground' },
  sent:         { label: 'Gesendet',     className: 'bg-primary/15 text-primary' },
  test_sent:    { label: 'Test',         className: 'bg-blue-500/15 text-blue-400' },
  delivered:    { label: 'Zugestellt',   className: 'bg-emerald-500/15 text-emerald-400' },
  opened:       { label: 'Geöffnet',     className: 'bg-amber-500/15 text-amber-400' },
  clicked:      { label: 'Geklickt',     className: 'bg-violet-500/15 text-violet-400' },
  bounced:      { label: 'Bounce',       className: 'bg-destructive/15 text-destructive' },
  failed:       { label: 'Fehlgeschlagen', className: 'bg-destructive/15 text-destructive' },
  unsubscribed: { label: 'Abgemeldet',   className: 'bg-orange-500/15 text-orange-400' },
};

function StatusPill({ status }: { status: string | null }) {
  const s = (status ?? '').toLowerCase();
  const meta = STATUS_LABELS[s] ?? { label: status ?? '—', className: 'bg-muted text-muted-foreground' };
  return <Badge variant="outline" className={`border-0 ${meta.className}`}>{meta.label}</Badge>;
}

function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('de-DE');
}
function fmtTime(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

const EVENT_LABEL: Record<string, string> = {
  sent: 'E-Mail gesendet',
  test_sent: 'Testmail gesendet',
  delivered: 'E-Mail zugestellt',
  opened: 'E-Mail geöffnet',
  clicked: 'Link geklickt',
  bounced: 'Bounce empfangen',
  failed: 'Versand fehlgeschlagen',
  unsubscribed: 'Abgemeldet',
};

export default function CustomerCommunication({ customer }: { customer: any }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [templates, setTemplates] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<MailMessage | null>(null);
  const [events, setEvents] = useState<MailEvent[]>([]);
  const [resendingId, setResendingId] = useState<string | null>(null);

  async function loadMessages() {
    if (!customer?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('mail_messages')
      .select('*')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) {
      toast.error('E-Mails konnten nicht geladen werden');
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as MailMessage[];
    setMessages(rows);
    const tplIds = Array.from(new Set(rows.map((r) => r.template_id).filter(Boolean))) as string[];
    if (tplIds.length > 0) {
      const { data: tpls } = await supabase
        .from('mail_templates')
        .select('id,name')
        .in('id', tplIds);
      const map: Record<string, string> = {};
      (tpls ?? []).forEach((t: any) => { map[t.id] = t.name; });
      setTemplates(map);
    } else {
      setTemplates({});
    }
    setLoading(false);
  }

  useEffect(() => {
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return messages.filter((m) => {
      if (filter !== 'all' && (m.status ?? '').toLowerCase() !== filter) return false;
      if (!q) return true;
      return (
        (m.subject ?? '').toLowerCase().includes(q) ||
        (m.to_email ?? '').toLowerCase().includes(q) ||
        (m.from_email ?? '').toLowerCase().includes(q) ||
        (m.to_name ?? '').toLowerCase().includes(q) ||
        (m.from_name ?? '').toLowerCase().includes(q)
      );
    });
  }, [messages, filter, search]);

  async function openDetail(m: MailMessage) {
    setSelected(m);
    setEvents([]);
    const { data } = await supabase
      .from('mail_events')
      .select('*')
      .eq('message_id', m.id)
      .order('created_at', { ascending: true });
    setEvents((data ?? []) as MailEvent[]);
  }

  function goToCompose(extra?: Record<string, any>) {
    navigate('/mailcenter/schreiben', {
      state: {
        customer: {
          id: customer.id,
          company_name: customer.company_name,
          contact_name: customer.contact_name,
          email: customer.email,
          phone: customer.phone,
          external_customer_id: customer.external_customer_id,
        },
        ...extra,
      },
    });
  }

  async function resend(m: MailMessage) {
    if (!m.to_email || !m.from_email || !m.subject) {
      toast.error('E-Mail unvollständig – kann nicht erneut gesendet werden');
      return;
    }
    setResendingId(m.id);
    try {
      const { data, error } = await supabase.functions.invoke('send-mail', {
        body: {
          template_id: m.template_id,
          customer_id: m.customer_id,
          order_id: m.order_id,
          invoice_id: m.invoice_id,
          repair_id: m.repair_id,
          to_email: m.to_email,
          to_name: m.to_name,
          from_email: m.from_email,
          from_name: m.from_name,
          subject: m.subject,
          body_html: m.body_html,
          body_text: m.body_text,
          subject_variables: {},
          body_variables: {},
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error(JSON.stringify((data as any).error));
      toast.success('E-Mail wurde erneut versendet');
      loadMessages();
    } catch (e) {
      console.error(e);
      toast.error('Erneuter Versand fehlgeschlagen');
    } finally {
      setResendingId(null);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 card-glow">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-display font-bold text-foreground flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" /> Kommunikation ({messages.length})
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => goToCompose()}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Neue E-Mail
          </Button>
          <Button size="sm" variant="outline" onClick={() => goToCompose({ mode: 'reply' })}>
            Antwort schreiben
          </Button>
          <Button size="sm" variant="outline" onClick={() => goToCompose({ mode: 'template' })}>
            Vorlage senden
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Betreff, Empfänger oder Absender suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="draft">Entwürfe</SelectItem>
            <SelectItem value="sent">Gesendet</SelectItem>
            <SelectItem value="delivered">Zugestellt</SelectItem>
            <SelectItem value="opened">Geöffnet</SelectItem>
            <SelectItem value="clicked">Geklickt</SelectItem>
            <SelectItem value="bounced">Bounce</SelectItem>
            <SelectItem value="failed">Fehlgeschlagen</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="ghost" onClick={loadMessages} title="Neu laden">
          <RotateCw className="w-4 h-4" />
        </Button>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Inbox className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">Keine E-Mails vorhanden.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left font-medium py-2 pr-3">Datum</th>
                <th className="text-left font-medium py-2 pr-3">Uhrzeit</th>
                <th className="text-left font-medium py-2 pr-3">Betreff</th>
                <th className="text-left font-medium py-2 pr-3">Absender</th>
                <th className="text-left font-medium py-2 pr-3">Empfänger</th>
                <th className="text-left font-medium py-2 pr-3">Status</th>
                <th className="text-left font-medium py-2 pr-3">Vorlage</th>
                <th className="text-right font-medium py-2">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => {
                const ref = m.sent_at || m.created_at;
                return (
                  <tr
                    key={m.id}
                    className="border-b border-border/50 hover:bg-muted/30 cursor-pointer"
                    onClick={() => openDetail(m)}
                  >
                    <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(ref)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">{fmtTime(ref)}</td>
                    <td className="py-2 pr-3 max-w-[260px] truncate font-medium">{m.subject || '—'}</td>
                    <td className="py-2 pr-3 text-muted-foreground truncate max-w-[180px]">{m.from_email || '—'}</td>
                    <td className="py-2 pr-3 text-muted-foreground truncate max-w-[180px]">{m.to_email || '—'}</td>
                    <td className="py-2 pr-3"><StatusPill status={m.status} /></td>
                    <td className="py-2 pr-3 text-muted-foreground truncate max-w-[140px]">
                      {m.template_id ? (templates[m.template_id] ?? '—') : 'Freie Nachricht'}
                    </td>
                    <td className="py-2 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); resend(m); }}
                        disabled={resendingId === m.id}
                        title="Erneut senden"
                      >
                        {resendingId === m.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Send className="w-3.5 h-3.5" />}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail-Modal */}
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" /> {selected?.subject || 'E-Mail'}
            </DialogTitle>
            <DialogDescription>Details und Event-Verlauf</DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-[120px_1fr] gap-2">
                <span className="text-muted-foreground">Absender:</span>
                <span className="font-mono">{selected.from_name ? `${selected.from_name} <${selected.from_email}>` : selected.from_email}</span>
                <span className="text-muted-foreground">Empfänger:</span>
                <span className="font-mono">{selected.to_name ? `${selected.to_name} <${selected.to_email}>` : selected.to_email}</span>
                <span className="text-muted-foreground">Versandzeit:</span>
                <span>{selected.sent_at ? new Date(selected.sent_at).toLocaleString('de-DE') : '—'}</span>
                <span className="text-muted-foreground">Status:</span>
                <span><StatusPill status={selected.status} /></span>
                {selected.order_id && (
                  <>
                    <span className="text-muted-foreground">Auftrag:</span>
                    <button
                      className="text-primary hover:underline text-left flex items-center gap-1"
                      onClick={() => navigate(`/auftraege/${selected.order_id}`)}
                    >
                      Öffnen <ExternalLink className="w-3 h-3" />
                    </button>
                  </>
                )}
                {selected.invoice_id && (
                  <>
                    <span className="text-muted-foreground">Rechnung:</span>
                    <span className="font-mono text-xs">{selected.invoice_id}</span>
                  </>
                )}
                {selected.repair_id && (
                  <>
                    <span className="text-muted-foreground">Reparatur:</span>
                    <span className="font-mono text-xs">{selected.repair_id}</span>
                  </>
                )}
              </div>

              <div>
                <div className="text-xs text-muted-foreground mb-1">Inhalt</div>
                <div className="rounded-md border border-border bg-muted/20 p-3 max-h-[260px] overflow-auto">
                  {selected.body_html ? (
                    <div
                      className="prose prose-sm max-w-none dark:prose-invert"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(selected.body_html) }}
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap text-sm font-sans">{selected.body_text || '—'}</pre>
                  )}
                </div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground mb-2">Event-Verlauf</div>
                {events.length === 0 ? (
                  <div className="text-xs text-muted-foreground">Keine Events vorhanden.</div>
                ) : (
                  <ol className="relative border-l border-border ml-2 space-y-3">
                    {events.map((ev) => (
                      <li key={ev.id} className="ml-4">
                        <div className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full bg-primary/60" />
                        <div className="text-xs text-muted-foreground">
                          {new Date(ev.created_at).toLocaleString('de-DE')}
                        </div>
                        <div className="text-sm">{EVENT_LABEL[ev.event_type] ?? ev.event_type}</div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {selected && (
              <Button variant="outline" onClick={() => resend(selected)} disabled={resendingId === selected.id}>
                {resendingId === selected.id
                  ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  : <Send className="w-3.5 h-3.5 mr-2" />}
                Erneut senden
              </Button>
            )}
            <Button onClick={() => setSelected(null)}>Schließen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
