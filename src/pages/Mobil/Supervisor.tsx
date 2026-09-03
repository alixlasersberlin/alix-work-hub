/**
 * SUPERVISOR COCKPIT (Prompt 6) – nur für berechtigte Rollen. Die Berechtigung
 * wird serverseitig im Snapshot (`is_supervisor`) entschieden; ohne Recht
 * werden keine Teamdaten geladen oder angezeigt.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Loader2, AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  fetchCommandSnapshot, fetchSlaThresholds, slaState, SLA_LABEL, minutesLabel,
  workloadScore, PRESENCE_LABEL, logMobileAudit, type CommandSnapshot, type SlaKey,
} from '@/lib/mobil/command';

type Unassigned = {
  id: string; priority: string | null; category: string | null; channel_type: string | null;
  last_message_preview: string | null; last_customer_message_at: string | null; created_at: string;
  assigned_department: string | null;
};

export default function MobilSupervisor() {
  const nav = useNavigate();
  const [snap, setSnap] = useState<CommandSnapshot | null>(null);
  const [sla, setSla] = useState<Record<SlaKey, number> | null>(null);
  const [queue, setQueue] = useState<Unassigned[]>([]);
  const [staff, setStaff] = useState<{ id: string; full_name: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await fetchCommandSnapshot();
      setSnap(s);
      if (!s.is_supervisor) { setDenied(true); setLoading(false); return; }
      const [q, st] = await Promise.all([
        (supabase as any).from('ac_conversations')
          .select('id,priority,category,channel_type,last_message_preview,last_customer_message_at,created_at,assigned_department')
          .is('assigned_to', null).neq('status', 'closed').eq('is_test', false)
          .order('last_message_at', { ascending: true }).limit(50),
        (supabase as any).from('user_profiles').select('id, full_name').eq('is_active', true).order('full_name').limit(200),
      ]);
      setQueue((q.data || []) as Unassigned[]);
      setStaff((st.data || []) as any[]);
    } catch (e: any) {
      toast.error(e?.message ?? 'Cockpit konnte nicht geladen werden.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetchSlaThresholds().then(setSla).catch(() => {}); }, []);

  useEffect(() => {
    const ch = supabase.channel('mobil-supervisor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ac_conversations' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const assign = async (conversationId: string, userId: string) => {
    const { error } = await (supabase as any).from('ac_conversations')
      .update({ assigned_to: userId, assigned_at: new Date().toISOString() }).eq('id', conversationId);
    if (error) { toast.error('Zuweisung fehlgeschlagen.'); return; }
    await logMobileAudit('SUPERVISOR_ASSIGNMENT', { assigned_to: userId }, conversationId);
    toast.success('Zugewiesen.');
    load();
  };

  if (denied) {
    return <div className="p-6 text-sm text-muted-foreground">Für diesen Bereich fehlt die Berechtigung.</div>;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2"><ShieldCheck className="w-5 h-5" /> Supervisor</h1>
        <Button variant="ghost" size="icon" className="h-11 w-11" onClick={load} aria-label="Aktualisieren">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
        </Button>
      </div>

      {snap && (
        <>
          <Card className="p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Team Briefing</div>
            <ul className="text-sm space-y-1">
              <li>{snap.counts.p1p2} P1/P2 offen</li>
              <li>{snap.counts.unassigned} nicht zugewiesene Chats</li>
              <li>{snap.escalations} aktive Eskalationen</li>
              <li>{snap.tickets.overdue} Tickets überfällig</li>
              <li>{snap.counts.unanswered} Kunden warten auf Antwort</li>
            </ul>
          </Card>

          <Card className="p-4 space-y-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Auslastung</div>
            {snap.team.length === 0 && <div className="text-sm text-muted-foreground">Keine Teamdaten.</div>}
            {snap.team.map((m) => {
              const w = workloadScore(m);
              return (
                <div key={m.user_id} className="flex items-center gap-3 py-1.5 border-b border-border/50 last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{m.name || 'Unbenannt'}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {PRESENCE_LABEL[m.status] ?? m.status} · {m.chats} Chats · {m.p1p2} P1/P2 · {m.tickets} Tickets · Score {w.score}
                    </div>
                  </div>
                  <Badge variant={w.level === 'HOCH' ? 'destructive' : w.level === 'MITTEL' ? 'secondary' : 'outline'} className="text-[10px]">
                    {w.level}
                  </Badge>
                </div>
              );
            })}
            <p className="text-[10px] text-muted-foreground">
              Score: P1/P2-Chat 5 · aktiver Chat 1 · offenes Ticket 2. Rein operative Verteilung, keine Bewertung.
            </p>
          </Card>
        </>
      )}

      <div className="space-y-2">
        <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Inbox className="h-3.5 w-3.5" /> Nicht zugewiesen ({queue.length})
        </div>
        {!loading && queue.length === 0 && (
          <Card className="p-5 text-center text-sm text-muted-foreground">Alle offenen Chats sind zugewiesen.</Card>
        )}
        {queue.map((c) => {
          const min = (Date.now() - new Date(c.last_customer_message_at || c.created_at).getTime()) / 60000;
          const st = sla ? slaState(c.priority, min, sla) : 'IM_ZEITPLAN';
          const crit = st === 'UEBERFAELLIG' || st === 'KRITISCH';
          return (
            <Card key={c.id} className={`p-3 space-y-2 ${crit ? 'border-destructive/50' : ''}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={c.priority === 'P1' ? 'destructive' : 'secondary'} className="text-[10px]">
                  {c.priority === 'P1' && <AlertTriangle className="h-3 w-3 mr-1" />}{c.priority || 'P3'}
                </Badge>
                {c.channel_type && <span className="text-[10px] uppercase text-muted-foreground">{c.channel_type}</span>}
                {c.assigned_department && <span className="text-[10px] text-muted-foreground">{c.assigned_department}</span>}
                <span className={`ml-auto text-[11px] ${crit ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                  {SLA_LABEL[st]} · {minutesLabel(min)}
                </span>
              </div>
              {c.last_message_preview && <div className="text-sm line-clamp-2">{c.last_message_preview}</div>}
              <div className="flex gap-2 items-center">
                <Button size="sm" variant="outline" className="h-10" onClick={() => nav(`/mobil/inbox/${c.id}`)}>Öffnen</Button>
                <Select onValueChange={(v) => assign(c.id, v)}>
                  <SelectTrigger className="h-10 flex-1"><SelectValue placeholder="Zuweisen an …" /></SelectTrigger>
                  <SelectContent>
                    {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name || s.id.slice(0, 8)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
