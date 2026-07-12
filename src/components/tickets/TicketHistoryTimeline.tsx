import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  Loader2, Activity, Flame, Mail, CalendarCheck, CalendarClock, CalendarX,
  UserPlus, ArrowRightLeft, Sparkles, MessageSquare, AlertTriangle, Route,
} from 'lucide-react';

type HistoryRow = {
  id: string;
  action: string | null;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  actor_id: string | null;
  meta: any;
  created_at: string;
};

const ACTION_META: Record<string, { label: string; icon: any; tone: string }> = {
  created: { label: 'Ticket erstellt', icon: Sparkles, tone: 'text-primary' },
  routed: { label: 'Automatisch geroutet', icon: Route, tone: 'text-primary' },
  assigned: { label: 'Zugewiesen', icon: UserPlus, tone: 'text-primary' },
  status_changed: { label: 'Status geändert', icon: ArrowRightLeft, tone: 'text-muted-foreground' },
  priority_changed: { label: 'Priorität geändert', icon: Flame, tone: 'text-amber-500' },
  auto_escalated: { label: 'Automatisch eskaliert', icon: Flame, tone: 'text-destructive' },
  followup_due: { label: 'Wiedervorlage fällig', icon: AlertTriangle, tone: 'text-amber-500' },
  appointment_created: { label: 'Termin erstellt', icon: CalendarClock, tone: 'text-primary' },
  appointment_email_sent: { label: 'Terminmail gesendet', icon: Mail, tone: 'text-primary' },
  appointment_confirmed: { label: 'Termin bestätigt', icon: CalendarCheck, tone: 'text-emerald-500' },
  appointment_rescheduled: { label: 'Termin verschoben', icon: CalendarClock, tone: 'text-amber-500' },
  appointment_cancelled: { label: 'Termin abgesagt', icon: CalendarX, tone: 'text-destructive' },
  appointment_confirmation_expired: { label: 'Bestätigung abgelaufen', icon: CalendarX, tone: 'text-destructive' },
  message_added: { label: 'Nachricht hinzugefügt', icon: MessageSquare, tone: 'text-muted-foreground' },
};

export function TicketHistoryTimeline({ ticketId }: { ticketId: string }) {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('ticket_history')
        .select('id, action, field, old_value, new_value, actor_id, meta, created_at')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (!cancelled) { setRows((data as any) ?? []); setLoading(false); }
    })();

    const channel = supabase
      .channel(`ticket_history_${ticketId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ticket_history', filter: `ticket_id=eq.${ticketId}` },
        (payload) => setRows((prev) => [payload.new as any, ...prev]))
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [ticketId]);

  if (loading) return <div className="p-4 flex justify-center"><Loader2 className="w-4 h-4 animate-spin" /></div>;
  if (rows.length === 0) return <div className="p-4 text-center text-muted-foreground text-[12px]">Noch keine Verlaufseinträge.</div>;

  return (
    <ol className="relative border-l border-border ml-3 space-y-3">
      {rows.map((h) => {
        const meta = ACTION_META[h.action ?? ''] ?? { label: h.action ?? '—', icon: Activity, tone: 'text-muted-foreground' };
        const Icon = meta.icon;
        return (
          <li key={h.id} className="ml-4">
            <span className={`absolute -left-[9px] flex items-center justify-center w-4 h-4 rounded-full bg-background ring-2 ring-border ${meta.tone}`}>
              <Icon className="w-2.5 h-2.5" />
            </span>
            <div className="rounded-lg border border-border bg-card px-3 py-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-[12.5px] font-medium">{meta.label}</span>
                  {h.field && <Badge variant="secondary" className="text-[10px] font-mono">{h.field}</Badge>}
                </div>
                <span className="text-[10.5px] text-muted-foreground">
                  {format(new Date(h.created_at), 'dd.MM.yyyy · HH:mm', { locale: de })}
                </span>
              </div>
              {(h.old_value || h.new_value) && (
                <div className="mt-1 text-[11.5px] text-muted-foreground">
                  {h.old_value && <span className="line-through opacity-70">{h.old_value}</span>}
                  {h.old_value && h.new_value && <span className="mx-1">→</span>}
                  {h.new_value && <span className="text-foreground">{h.new_value}</span>}
                </div>
              )}
              {h.meta && Object.keys(h.meta).length > 0 && (
                <details className="mt-1">
                  <summary className="text-[10.5px] text-muted-foreground cursor-pointer hover:text-foreground">Details</summary>
                  <pre className="mt-1 text-[10.5px] bg-muted/40 rounded p-1.5 overflow-auto max-h-32">{JSON.stringify(h.meta, null, 2)}</pre>
                </details>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
