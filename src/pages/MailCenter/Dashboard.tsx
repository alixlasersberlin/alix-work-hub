import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Send, MailOpen, MousePointerClick, AlertTriangle, ShieldAlert, Loader2,
  Inbox, Wrench, AlertOctagon,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type Kpis = {
  sentToday: number; openedToday: number; clickedToday: number;
  bouncedToday: number; complainedToday: number;
  newMessages: number; openRequests: number; openRepairs: number; critical: number;
};

export default function MailCenterDashboard() {
  const [kpis, setKpis] = useState<Kpis | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const iso = start.toISOString();

      const countFor = async (column: string) => {
        const { count } = await supabase.from('mail_messages')
          .select('id', { count: 'exact', head: true }).gte(column, iso);
        return count ?? 0;
      };

      const [sent, opened, clicked, bounced, complained, newMsgs, openReq, openRep, crit] = await Promise.all([
        countFor('sent_at'),
        countFor('opened_at'),
        countFor('clicked_at'),
        countFor('bounced_at'),
        supabase.from('mail_messages').select('id', { count: 'exact', head: true })
          .eq('status', 'complained').gte('updated_at', iso).then(r => r.count ?? 0),
        supabase.from('mail_messages').select('id', { count: 'exact', head: true })
          .eq('direction', 'inbound').eq('is_read', false).then(r => r.count ?? 0),
        supabase.from('mail_messages').select('id', { count: 'exact', head: true })
          .eq('direction', 'inbound').is('assigned_to', null).then(r => r.count ?? 0),
        supabase.from('repair_orders').select('id', { count: 'exact', head: true })
          .not('repair_status', 'ilike', '%abgeschlossen%').then(r => r.count ?? 0),
        supabase.from('mail_messages').select('id', { count: 'exact', head: true })
          .eq('priority', 'Kritisch').then(r => r.count ?? 0),
      ]);

      if (mounted) {
        setKpis({
          sentToday: sent, openedToday: opened, clickedToday: clicked,
          bouncedToday: bounced, complainedToday: complained,
          newMessages: newMsgs, openRequests: openReq, openRepairs: openRep, critical: crit,
        });
      }
    })();
    return () => { mounted = false; };
  }, []);

  const cards = [
    { label: 'Neue Nachrichten', value: kpis?.newMessages, icon: Inbox },
    { label: 'Offene Kundenanfragen', value: kpis?.openRequests, icon: Inbox },
    { label: 'Offene Reparaturen', value: kpis?.openRepairs, icon: Wrench },
    { label: 'Kritische Vorgänge', value: kpis?.critical, icon: AlertOctagon },
    { label: 'Heute versendet', value: kpis?.sentToday, icon: Send },
    { label: 'Heute geöffnet', value: kpis?.openedToday, icon: MailOpen },
    { label: 'Heute geklickt', value: kpis?.clickedToday, icon: MousePointerClick },
    { label: 'Bounces heute', value: kpis?.bouncedToday, icon: AlertTriangle },
    { label: 'Beschwerden heute', value: kpis?.complainedToday, icon: ShieldAlert },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-display font-semibold text-foreground">Übersicht</h2>
        <p className="text-sm text-muted-foreground">Live-KPIs aus MailCenter und Operations.</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="card-glow">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {k.label}
                </CardTitle>
                <Icon className="w-4 h-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-display font-bold text-foreground">
                  {kpis === null ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : (k.value ?? 0)}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

