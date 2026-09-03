/**
 * GERÄTE COMMAND VIEW (Prompt 6) – liest ausschliesslich vorhandene
 * Gerätedaten aus `lager_devices` plus verknüpfte Tickets. Es werden keine
 * Statuswerte erfunden; Hinweise erscheinen nur bei echten Daten.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Cpu, Loader2, AlertTriangle, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function MobilGeraetDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [dev, setDev] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any).from('lager_devices').select('*').eq('id', id).maybeSingle();
      if (cancelled) return;
      setDev(data);
      if (data?.serial_number) {
        const { data: tk } = await (supabase as any).from('tickets')
          .select('id, ticket_number, subject, title, status, priority, created_at')
          .eq('serial_number', data.serial_number).order('created_at', { ascending: false }).limit(20);
        if (!cancelled) setTickets(tk || []);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>;
  if (!dev) return <div className="p-6 text-sm text-muted-foreground">Gerät nicht gefunden.</div>;

  const serviceOverdue = dev.next_service_date ? new Date(dev.next_service_date) < new Date() : false;
  const openCritical = tickets.some((t) => ['P1', 'P2'].includes(t.priority) && !['closed', 'geschlossen', 'erledigt', 'resolved'].includes((t.status || '').toLowerCase()));

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-bold flex items-center gap-2"><Cpu className="w-5 h-5" /> {dev.model_name || 'Gerät'}</h1>

      {(serviceOverdue || openCritical) && (
        <Card className="p-3 border-amber-500/50 bg-amber-500/10 text-sm flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            {serviceOverdue && <div>Wartung überfällig (fällig {new Date(dev.next_service_date).toLocaleDateString('de-DE')}).</div>}
            {openCritical && <div>Offener kritischer Servicefall vorhanden.</div>}
          </div>
        </Card>
      )}

      <Card className="p-4 space-y-1 text-sm">
        <Line l="Seriennummer" v={dev.serial_number} />
        <Line l="Status" v={dev.device_status} />
        <Line l="Kunde" v={dev.customer_name} />
        <Line l="Inbetriebnahme" v={dev.commissioning_date ? new Date(dev.commissioning_date).toLocaleDateString('de-DE') : null} />
        <Line l="Letzter Service" v={dev.last_service_date ? new Date(dev.last_service_date).toLocaleDateString('de-DE') : null} />
        <Line l="Nächster Service" v={dev.next_service_date ? new Date(dev.next_service_date).toLocaleDateString('de-DE') : null} />
        <Line l="Quelle" v={dev.source_system} />
        {dev.customer_email && (
          <div className="pt-2 flex gap-2">
            <Button variant="outline" size="sm" className="h-10 flex-1" asChild>
              <a href={`mailto:${dev.customer_email}`}>E-Mail</a>
            </Button>
          </div>
        )}
      </Card>

      <div className="space-y-2">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Tickets ({tickets.length})</div>
        {tickets.length === 0 && <Card className="p-4 text-sm text-muted-foreground text-center">Keine Tickets zu diesem Gerät.</Card>}
        {tickets.map((t) => (
          <Card key={t.id} className="p-3 active:bg-muted/40">
            <button className="w-full text-left" onClick={() => nav(`/tickets?ticket=${t.id}`)}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono">{t.ticket_number}</span>
                {t.priority && <Badge variant={t.priority === 'P1' ? 'destructive' : 'secondary'} className="text-[10px]">{t.priority}</Badge>}
                <span className="ml-auto text-[11px] text-muted-foreground">{t.status}</span>
              </div>
              <div className="text-sm mt-1 line-clamp-2">{t.subject || t.title}</div>
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Line({ l, v }: { l: string; v: any }) {
  if (!v) return null;
  return (
    <div className="flex justify-between gap-3 py-1 border-b border-border/40 last:border-0">
      <span className="text-muted-foreground text-xs">{l}</span>
      <span className="text-sm text-right break-all">{String(v)}</span>
    </div>
  );
}
