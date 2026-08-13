import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { MapPin, Truck, ClipboardList, Users, Cpu, Wrench, FileText, Loader2 } from 'lucide-react';
import { cacheGet, cacheSet, greeting } from '@/lib/mobil/utils';

interface Stats { tours: number; stops: number; orders: number; service: number }

export default function MobilHome() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<Stats>(cacheGet<Stats>('stats') ?? { tours: 0, stops: 0, orders: 0, service: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const [tours, orders, appts] = await Promise.all([
        supabase.from('delivery_tours').select('id, delivery_tour_stops(count)').eq('tour_date', today).limit(50),
        supabase.from('orders').select('id', { count: 'exact', head: true }).not('order_status', 'in', '("Abgeschlossen","abgeschlossen","storniert")'),
        supabase.from('delivery_appointments').select('id', { count: 'exact', head: true }).eq('planned_date', today),
      ]);
      if (cancelled) return;
      const next: Stats = {
        tours: (tours.data ?? []).length,
        stops: ((tours.data ?? []) as any[]).reduce((s, t) => s + (t.delivery_tour_stops?.[0]?.count ?? 0), 0),
        orders: orders.count ?? 0,
        service: appts.count ?? 0,
      };
      setStats(next);
      cacheSet('stats', next);
      setLoading(false);
    })().catch(() => setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const name = (profile?.full_name || profile?.email || '').split(' ')[0];

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold leading-tight">{greeting()}{name ? `, ${name}` : ''}</h1>
        <p className="text-sm text-muted-foreground">{format(new Date(), 'EEEE, dd.MM.yyyy')}</p>
      </div>

      <Card className="p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
          Heute {loading && <Loader2 className="w-3 h-3 animate-spin" />}
        </div>
        <div className="grid grid-cols-4 text-center">
          <Num v={stats.tours} l="Touren" />
          <Num v={stats.stops} l="Stopps" />
          <Num v={stats.orders} l="Aufträge" />
          <Num v={stats.service} l="Service" />
        </div>
      </Card>

      <div className="space-y-3">
        <Link to="/mobil/adressen">
          <Card className="p-6 flex items-center gap-4 bg-primary/10 border-primary/30 active:scale-[0.99] transition-transform min-h-[96px]">
            <MapPin className="w-9 h-9 text-primary shrink-0" />
            <div>
              <div className="text-xl font-bold">ADRESSE SUCHEN</div>
              <div className="text-sm text-muted-foreground">Kunde, Straße, PLZ, Telefon …</div>
            </div>
          </Card>
        </Link>
        <Link to="/mobil/touren">
          <Card className="p-6 flex items-center gap-4 bg-primary/10 border-primary/30 active:scale-[0.99] transition-transform min-h-[96px]">
            <Truck className="w-9 h-9 text-primary shrink-0" />
            <div>
              <div className="text-xl font-bold">MEINE TOUREN</div>
              <div className="text-sm text-muted-foreground">{stats.tours} heute · {stats.stops} Stopps</div>
            </div>
          </Card>
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Quick to="/mobil/auftraege" icon={ClipboardList} label="Aufträge" />
        <Quick to="/mobil/adressen" icon={Users} label="Kunden" />
        <Quick to="/mobil/suche?k=geraet" icon={Cpu} label="Geräte" />
        <Quick to="/mobil/suche?k=reparatur" icon={Wrench} label="Service" />
        <Quick to="/m/alixdocs" icon={FileText} label="Dokumente" />
        <Quick to="/mobil/mehr" icon={MapPin} label="Mehr" />
      </div>
    </div>
  );
}

function Num({ v, l }: { v: number; l: string }) {
  return (
    <div>
      <div className="text-xl font-bold">{v}</div>
      <div className="text-[11px] text-muted-foreground">{l}</div>
    </div>
  );
}

function Quick({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <Link to={to}>
      <Card className="p-3 min-h-[76px] flex flex-col items-center justify-center gap-1 active:bg-muted/40">
        <Icon className="w-5 h-5 text-primary" />
        <span className="text-xs font-medium">{label}</span>
      </Card>
    </Link>
  );
}
