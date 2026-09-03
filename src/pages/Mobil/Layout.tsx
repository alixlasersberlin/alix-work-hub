import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Home, Truck, ClipboardList, MessageSquare, MoreHorizontal, WifiOff, ArrowLeft, Search, Bell, X, Ticket, Plus, Clock, ArrowLeftRight } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/mobil/haptics';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOnlineStatus } from '@/hooks/emp/useOnlineStatus';
import { Button } from '@/components/ui/button';
import { cacheGet, cacheSet } from '@/lib/mobil/utils';
import { syncBadge, takePendingDeepLink } from '@/lib/mobile/push-registration';
import { format } from 'date-fns';
import AppLockGate from '@/components/mobil/AppLockGate';
import MobilErrorBoundary from '@/components/mobil/MobilErrorBoundary';
import MobileOpsGate, { MobileOpsBanners } from '@/components/mobil/MobileOpsGate';
import { touchTrustedDevice, markActivity } from '@/lib/mobil/security';
import { APP_VERSION_MOBILE } from '@/lib/mobil/appInfo';

type Banner = { title: string; message: string; url: string; priority: string } | null;

function MobilLayoutInner() {
  const online = useOnlineStatus();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const { profile, user } = useAuth();
  const [openStops, setOpenStops] = useState<number>(cacheGet<number>('openStops') ?? 0);
  const [inboxUnread, setInboxUnread] = useState<number>(cacheGet<number>('inboxUnread') ?? 0);
  const [notifUnread, setNotifUnread] = useState(0);
  const [banner, setBanner] = useState<Banner>(null);
  const [fabOpen, setFabOpen] = useState(false);
  const wasOffline = useRef(false);

  const initials = (profile?.full_name || profile?.email || 'A')
    .split(/[\s.@]+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'A';

  // Reconnect-Feedback: kurz und einmalig, kein Dauerbanner.
  useEffect(() => {
    if (!online) { wasOffline.current = true; return; }
    if (wasOffline.current) {
      wasOffline.current = false;
      haptic('success');
      toast.success('Wieder verbunden');
    }
  }, [online]);



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

  // Gerät registrieren / letzte Aktivität (Prompt 7)
  useEffect(() => {
    if (!user?.id) return;
    markActivity();
    void touchTrustedDevice(APP_VERSION_MOBILE);
  }, [user?.id]);

  // Deep Link aus Push (nach Login / SW-Nachricht)
  useEffect(() => {
    const pending = takePendingDeepLink();
    if (pending) nav(pending);
    const onSwMessage = (e: MessageEvent) => {
      if (e.data?.type === 'alix-deeplink' && typeof e.data.url === 'string') nav(e.data.url);
    };
    navigator.serviceWorker?.addEventListener('message', onSwMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', onSwMessage);
  }, [nav]);

  // Inbox-Badge (ungelesene WhatsApp-Nachrichten) — Realtime
  useEffect(() => {
    let cancelled = false;
    const loadUnread = async () => {
      const { data } = await (supabase as any)
        .from('ac_conversations')
        .select('unread_count')
        .neq('inbox_status', 'ARCHIVED')
        .gt('unread_count', 0)
        .limit(500);
      if (cancelled) return;
      const n = (data ?? []).reduce((s: number, r: any) => s + (r.unread_count ?? 0), 0);
      setInboxUnread(n);
      cacheSet('inboxUnread', n);
      syncBadge(n);
    };
    loadUnread();
    const ch = supabase
      .channel('mobil-inbox-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ac_conversations' }, loadUnread)
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, []);

  // Interne Benachrichtigungen + In-App-Banner
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const load = async () => {
      const { count } = await (supabase as any)
        .from('app_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).is('read_at', null);
      if (!cancelled) setNotifUnread(count ?? 0);
    };
    load();
    const ch = supabase
      .channel('mobil-app-notifications')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'app_notifications', filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          const n = payload.new;
          setBanner({ title: n.title, message: n.message, url: n.action_url || '/mobil/benachrichtigungen', priority: n.priority || 'P3' });
          setTimeout(() => setBanner(null), 8000);
          load();
        })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [user?.id]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header
        className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-xl px-1.5 py-2 flex items-center gap-1"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}
      >
        <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" onClick={() => nav(-1)} aria-label="Zurück">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0 leading-tight">
          <div className="text-sm font-semibold tracking-[0.16em]">ALIXWORK</div>
          <div className="text-[10px] text-muted-foreground truncate">Mobile Command Center</div>
        </div>
        <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" onClick={() => nav('/mobil/magic-suche')} aria-label="Suche">
          <Search className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-11 w-11 relative shrink-0" onClick={() => nav('/mobil/benachrichtigungen')} aria-label={`Benachrichtigungen${notifUnread ? `, ${notifUnread} ungelesen` : ''}`}>
          <Bell className="h-5 w-5" />
          {notifUnread > 0 && (
            <span className="absolute top-1.5 right-1 bg-destructive text-destructive-foreground text-[10px] font-semibold rounded-full px-1.5 min-w-[18px] text-center">
              {notifUnread > 99 ? '99+' : notifUnread}
            </span>
          )}
        </Button>
        <button
          onClick={() => nav('/mobil/mehr')}
          aria-label="Profil und Einstellungen"
          className="h-11 w-11 shrink-0 flex items-center justify-center"
        >
          <span className="h-8 w-8 rounded-full bg-primary/15 text-primary text-xs font-semibold flex items-center justify-center">
            {initials}
          </span>
        </button>
      </header>

      {!online && (
        <div className="sticky top-[3.25rem] z-30 mx-3 mt-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] flex items-center gap-2">
          <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="font-medium">Offline</span>
          <span className="text-muted-foreground">· Stand {format(new Date(), 'HH:mm')} Uhr</span>
        </div>
      )}


      <MobileOpsBanners />

      {banner && (
        <button
          onClick={() => { nav(banner.url); setBanner(null); }}
          className={`sticky top-[3.5rem] z-40 mx-2 mt-2 rounded-lg border px-3 py-2 text-left shadow-lg ${
            banner.priority === 'P1' ? 'border-destructive bg-destructive/10' : 'border-primary/40 bg-primary/10'
          }`}
        >
          <div className="flex items-start gap-2">
            <Bell className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate">{banner.title}</div>
              <div className="text-xs text-muted-foreground line-clamp-2">{banner.message}</div>
            </div>
            <X className="h-4 w-4 shrink-0" onClick={(e) => { e.stopPropagation(); setBanner(null); }} />
          </div>
        </button>
      )}

      <main className="flex-1" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 5.5rem)' }}>
        <MobilErrorBoundary area="mobil">
          <div key={pathname} className="mobil-page-enter">
            <Outlet />
          </div>
        </MobilErrorBoundary>
      </main>


      {/* Globale Schnellaktion – einhändig erreichbar */}
      {fabOpen && (
        <button
          className="fixed inset-0 z-40 bg-black/40"
          aria-label="Schnellaktionen schliessen"
          onClick={() => setFabOpen(false)}
        />
      )}
      <div
        className="fixed right-4 z-50 flex flex-col items-end gap-2"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 5rem)' }}
      >
        {fabOpen && (
          <>
            <FabAction icon={Clock} label="Wiedervorlage" onClick={() => { setFabOpen(false); nav('/mobil/wiedervorlagen'); }} />
            <FabAction icon={ArrowLeftRight} label="Übergabe" onClick={() => { setFabOpen(false); nav('/mobil/uebergabe'); }} />
            <FabAction icon={Truck} label="Touren" onClick={() => { setFabOpen(false); nav('/mobil/touren'); }} />
            <FabAction icon={ClipboardList} label="Aufträge" onClick={() => { setFabOpen(false); nav('/mobil/auftraege'); }} />
          </>
        )}
        <button
          onClick={() => setFabOpen((v) => !v)}
          aria-label="Schnellaktionen"
          aria-expanded={fabOpen}
          className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center active:scale-95 transition-transform"
        >
          <Plus className={`h-6 w-6 transition-transform ${fabOpen ? 'rotate-45' : ''}`} />
        </button>
      </div>

      <nav
        className="fixed bottom-0 inset-x-0 z-30 border-t border-border bg-background/95 backdrop-blur grid grid-cols-5 text-[11px]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <Tab to="/mobil" icon={Home} label="Home" exact />
        <Tab to="/mobil/inbox" icon={MessageSquare} label="Inbox" badge={inboxUnread} />
        <Tab to="/mobil/magic-suche" icon={Search} label="Suche" />
        <Tab to="/mobil/tickets" icon={Ticket} label="Tickets" />
        <Tab to="/mobil/mehr" icon={MoreHorizontal} label="Mehr" />
      </nav>
    </div>
  );
}

export default function MobilLayout() {
  return (
    <AppLockGate>
      <MobileOpsGate>
        <MobilLayoutInner />
      </MobileOpsGate>
    </AppLockGate>
  );
}


function Tab({ to, icon: Icon, label, exact, badge }: { to: string; icon: any; label: string; exact?: boolean; badge?: number }) {
  return (
    <NavLink
      to={to}
      end={exact}
      onClick={() => haptic('light')}
      className={({ isActive }) =>
        `relative flex flex-col items-center justify-center gap-0.5 py-3 min-h-[56px] transition-colors duration-150 ${
          isActive ? 'text-primary font-semibold' : 'text-muted-foreground active:text-foreground'
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

function FabAction({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-full border border-border bg-background/95 backdrop-blur px-4 min-h-[44px] shadow-lg text-sm font-medium active:bg-muted"
    >
      <Icon className="h-4 w-4 text-primary" />
      {label}
    </button>
  );
}
