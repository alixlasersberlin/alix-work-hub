/**
 * TICKET COMMAND CENTER (Prompt 6) – mobile Steuerung der BESTEHENDEN
 * Ticketverwaltung. Es wird ausschliesslich `tickets` gelesen/aktualisiert;
 * keine zweite Ticketlogik, keine destruktiven Swipe-Aktionen.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Ticket as TicketIcon, Loader2, MessageSquare, RefreshCw, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { logMobileAudit, minutesLabel } from '@/lib/mobil/command';

const DONE = ['closed', 'geschlossen', 'erledigt', 'resolved'];
const TABS = ['MEINE', 'NEU', 'P1P2', 'UEBERFAELLIG', 'WARTET', 'ERLEDIGT'] as const;
type Tab = typeof TABS[number];
const TAB_LABEL: Record<Tab, string> = {
  MEINE: 'Meine', NEU: 'Neu', P1P2: 'P1/P2', UEBERFAELLIG: 'Überfällig', WARTET: 'Wartet', ERLEDIGT: 'Erledigt',
};

type Row = {
  id: string; ticket_number: string | null; case_number: string | null; subject: string | null; title: string | null;
  customer_name: string | null; company_name: string | null; device_name: string | null; serial_number: string | null;
  category: string | null; priority: string | null; status: string | null; assigned_to: string | null;
  comm_status: string | null; created_at: string; updated_at: string | null; resolution_due_at: string | null;
};

export default function MobilTicketCenter() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab) || 'MEINE');
  const [rows, setRows] = useState<Row[]>([]);
  const [links, setLinks] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let q = (supabase as any).from('tickets')
      .select('id,ticket_number,case_number,subject,title,customer_name,company_name,device_name,serial_number,category,priority,status,assigned_to,comm_status,created_at,updated_at,resolution_due_at')
      .order('created_at', { ascending: false }).limit(100);

    switch (tab) {
      case 'MEINE': q = q.eq('assigned_to', user?.id ?? '').not('status', 'in', `(${DONE.map((d) => `"${d}"`).join(',')})`); break;
      case 'NEU': q = q.is('assigned_to', null).not('status', 'in', `(${DONE.map((d) => `"${d}"`).join(',')})`); break;
      case 'P1P2': q = q.in('priority', ['P1', 'P2']).not('status', 'in', `(${DONE.map((d) => `"${d}"`).join(',')})`); break;
      case 'UEBERFAELLIG': q = q.lt('resolution_due_at', new Date().toISOString()).not('status', 'in', `(${DONE.map((d) => `"${d}"`).join(',')})`); break;
      case 'WARTET': q = q.in('comm_status', ['awaiting_customer', 'awaiting_internal', 'awaiting_appointment_confirm']); break;
      case 'ERLEDIGT': q = q.in('status', DONE); break;
    }
    const { data, error } = await q;
    if (error) { toast.error('Tickets konnten nicht geladen werden.'); setLoading(false); return; }
    const list = (data || []) as Row[];
    setRows(list);
    setLoading(false);

    if (list.length) {
      const { data: ct } = await (supabase as any).from('conversation_tickets')
        .select('ticket_id, conversation_id').in('ticket_id', list.map((r) => r.id));
      const map: Record<string, string[]> = {};
      for (const r of ct || []) (map[r.ticket_id] ||= []).push(r.conversation_id);
      setLinks(map);
    } else setLinks({});
  }, [tab, user?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel('mobil-ticket-center')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const setTabAndUrl = (t: Tab) => { setTab(t); setParams({ tab: t }); };

  const takeOver = async (r: Row) => {
    if (!user?.id) return;
    const { error } = await (supabase as any).from('tickets').update({ assigned_to: user.id }).eq('id', r.id);
    if (error) { toast.error('Übernahme fehlgeschlagen.'); return; }
    await logMobileAudit('ASSIGNMENT_CHANGED_MOBILE', { ticket_id: r.id, assigned_to: user.id });
    toast.success('Ticket übernommen.');
    load();
  };

  const openChat = (r: Row) => {
    const convs = links[r.id] || [];
    if (convs.length === 1) nav(`/mobil/inbox/${convs[0]}`);
    else if (convs.length > 1) nav(`/mobil/inbox?ticket=${r.id}`);
  };

  const count = useMemo(() => rows.length, [rows]);

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2"><TicketIcon className="w-5 h-5" /> Tickets</h1>
        <Button variant="ghost" size="icon" className="h-11 w-11" onClick={load} aria-label="Aktualisieren">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
        </Button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTabAndUrl(t)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs border min-h-[34px] ${
              tab === t ? 'border-primary bg-primary/15 text-primary font-semibold' : 'border-border text-muted-foreground'
            }`}>
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      <div className="text-xs text-muted-foreground">{count} Ticket{count === 1 ? '' : 's'}</div>

      {!loading && rows.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">Keine Tickets in dieser Ansicht.</Card>
      )}

      {rows.map((r) => {
        const ageMin = (Date.now() - new Date(r.created_at).getTime()) / 60000;
        const overdue = r.resolution_due_at ? new Date(r.resolution_due_at) < new Date() && !DONE.includes((r.status || '').toLowerCase()) : false;
        const convs = links[r.id] || [];
        return (
          <Card key={r.id} className={`p-3 space-y-2 ${overdue ? 'border-destructive/50' : ''}`}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono">{r.ticket_number || r.case_number || '—'}</span>
              {r.priority && (
                <Badge variant={r.priority === 'P1' ? 'destructive' : 'secondary'} className="text-[10px]">
                  {r.priority === 'P1' && <AlertTriangle className="h-3 w-3 mr-1" />}{r.priority}
                </Badge>
              )}
              {overdue && <Badge variant="destructive" className="text-[10px]">Überfällig</Badge>}
              <span className="ml-auto text-[11px] text-muted-foreground">{minutesLabel(ageMin)} alt</span>
            </div>
            <div className="text-sm font-semibold line-clamp-2">{r.subject || r.title || 'Ohne Betreff'}</div>
            <div className="text-xs text-muted-foreground">
              {[r.company_name || r.customer_name, r.device_name, r.serial_number, r.category, r.status].filter(Boolean).join(' · ')}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" className="h-9 flex-1 min-w-[92px]" onClick={() => nav(`/tickets?ticket=${r.id}`)}>Öffnen</Button>
              {r.assigned_to !== user?.id && (
                <Button size="sm" variant="outline" className="h-9 flex-1 min-w-[92px]" onClick={() => takeOver(r)}>Übernehmen</Button>
              )}
              {convs.length > 0 && (
                <Button size="sm" variant="outline" className="h-9 min-w-[92px]" onClick={() => openChat(r)}>
                  <MessageSquare className="h-4 w-4 mr-1" /> Chat{convs.length > 1 ? ` (${convs.length})` : ''}
                </Button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
