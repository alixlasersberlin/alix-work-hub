import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Home, Search, Truck, ClipboardList, MoreHorizontal, Wifi, WifiOff, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOnlineStatus } from '@/hooks/emp/useOnlineStatus';
import { Button } from '@/components/ui/button';
import { cacheGet, cacheSet } from '@/lib/mobil/utils';
import { format } from 'date-fns';

export default function MobilLayout() {
  const online = useOnlineStatus();
  const nav = useNavigate();
  const { profile } = useAuth();
  const [openStops, setOpenStops] = useState<number>(cacheGet<number>('openStops') ?? 0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data } = await supabase
        .from('delivery_tours')
        .select('id, delivery_tour_stops(count)')
        .eq('tour_date', today)
        .limit(50);
      if (cancelled || !data) return;
      const n = (data as any[]).reduce((s, t) => s + (t.delivery_tour_stops?.[0]?.count ?? 0), 0);
      setOpenStops(n);
      cacheSet('openStops', n);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header
        className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur px-2 py-2 flex items-center gap-2"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}
      >
        <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => nav(-1)} aria-label="Zurück">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none">AlixWork · Mobil</div>
          <div className="text-sm font-semibold leading-tight truncate">{profile?.full_name || profile?.email || 'Mitarbeiter'}</div>
        </div>
        <span
          className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full ${
            online ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'
          }`}
        >
          {online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {online ? 'online' : 'offline'}
        </span>
        <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => nav('/mobil/suche')} aria-label="Suche">
          <Search className="h-5 w-5" />
        </Button>
      </header>

      <main className="flex-1" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 5.5rem)' }}>
        <Outlet />
      </main>

      <nav
        className="fixed bottom-0 inset-x-0 z-30 border-t border-border bg-background/95 backdrop-blur grid grid-cols-5 text-[11px]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <Tab to="/mobil" icon={Home} label="Home" exact />
        <Tab to="/mobil/suche" icon={Search} label="Suche" />
        <Tab to="/mobil/touren" icon={Truck} label="Touren" badge={openStops} />
        <Tab to="/mobil/auftraege" icon={ClipboardList} label="Aufträge" />
        <Tab to="/mobil/mehr" icon={MoreHorizontal} label="Mehr" />
      </nav>
    </div>
  );
}

function Tab({ to, icon: Icon, label, exact, badge }: { to: string; icon: any; label: string; exact?: boolean; badge?: number }) {
  return (
    <NavLink
      to={to}
      end={exact}
      className={({ isActive }) =>
        `relative flex flex-col items-center justify-center gap-0.5 py-3 min-h-[56px] transition-colors ${
          isActive ? 'text-primary' : 'text-muted-foreground active:text-foreground'
        }`
      }
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium">{label}</span>
      {!!badge && (
        <span className="absolute top-1.5 right-[22%] bg-primary text-primary-foreground text-[10px] rounded-full px-1.5 min-w-[18px] text-center">
          {badge}
        </span>
      )}
    </NavLink>
  );
}
