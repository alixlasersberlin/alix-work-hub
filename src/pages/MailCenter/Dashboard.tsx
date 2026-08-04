import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiTile } from '@/components/infinity/KpiTile';
import {
  Send, MailOpen, MousePointerClick, AlertTriangle, ShieldAlert, Loader2,
  Inbox, Wrench, AlertOctagon,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';

type Kpis = {
  sentToday: number; openedToday: number; clickedToday: number;
  bouncedToday: number; complainedToday: number;
  newMessages: number; openRequests: number; openRepairs: number; critical: number;
};

export default function MailCenterDashboard() {
  const [kpis, setKpis] = useState<Kpis | null>(null);

  const load = useCallback(async () => {
    // Eine Server-Abfrage statt neun einzelner Count-Queries.
    const { data } = await supabase.rpc('mailcenter_dashboard_kpis' as any);
    const k = (data ?? {}) as Record<string, number>;
    setKpis({
      sentToday: Number(k.sentToday || 0),
      openedToday: Number(k.openedToday || 0),
      clickedToday: Number(k.clickedToday || 0),
      bouncedToday: Number(k.bouncedToday || 0),
      complainedToday: Number(k.complainedToday || 0),
      newMessages: Number(k.newMessages || 0),
      openRequests: Number(k.openRequests || 0),
      openRepairs: Number(k.openRepairs || 0),
      critical: Number(k.critical || 0),
    });
  }, []);

  useEffect(() => { load(); }, [load]);
  useRealtimeRefresh(['mail_messages', 'repair_orders'], load);

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
        {cards.map((k) => (
          <KpiTile
            key={k.label}
            label={k.label}
            value={kpis === null ? '…' : (k.value ?? 0)}
            icon={k.icon}
            accent="gold"
          />
        ))}
      </div>
    </div>
  );
}

