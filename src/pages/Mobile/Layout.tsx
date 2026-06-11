import { ReactNode, useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Home, CalendarDays, RefreshCw, Wifi, WifiOff, LogOut, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { startAutoSync, flush, list as outboxList } from '@/lib/mobile/outbox';
import { useUiTemplate } from '@/hooks/useUiTemplate';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function MobileLayout({ children }: { children?: ReactNode }) {
  const { profile, signOut } = useAuth();
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    startAutoSync();
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    const refresh = async () => setPending((await outboxList()).length);
    const t = setInterval(refresh, 5000);
    refresh();
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); clearInterval(t); };
  }, []);

  const onSync = async () => {
    if (syncing) return;
    setSyncing(true);
    const r = await flush();
    setPending((await outboxList()).length);
    setSyncing(false);
    if (r.ok || r.failed) toast.success(`Sync: ${r.ok} ok${r.failed ? ` · ${r.failed} offen` : ''}`);
    else toast.info('Nichts zu synchronisieren.');
  };

  const initials = (profile?.full_name || profile?.email || '?')
    .split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header
        className="sticky top-0 z-30 bg-card/95 backdrop-blur border-b border-border px-4 py-3 flex items-center justify-between"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
      >
        <Link to="/m" className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-md bg-primary/10 text-primary grid place-items-center text-xs font-bold">{initials}</span>
          <div className="leading-tight">
            <div className="font-display font-bold gold-text text-base">Alix Mobile</div>
            <div className="text-[10px] text-muted-foreground truncate max-w-[40vw]">{profile?.full_name || profile?.email}</div>
          </div>
        </Link>
        <div className="flex items-center gap-1">
          <span
            className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full ${
              online ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'
            }`}
            aria-label={online ? 'online' : 'offline'}
          >
            {online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {online ? 'online' : 'offline'}
          </span>
          <Button size="sm" variant="ghost" onClick={onSync} className="relative h-9 w-9 p-0" aria-label="Synchronisieren">
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {pending > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[10px] rounded-full px-1.5 min-w-[18px] text-center">
                {pending}
              </span>
            )}
          </Button>
          <Button size="sm" variant="ghost" onClick={signOut} className="h-9 w-9 p-0" aria-label="Abmelden">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main
        className="flex-1"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 5rem)' }}
      >
        {children ?? <Outlet />}
      </main>

      <nav
        className="fixed bottom-0 inset-x-0 z-30 bg-card/95 backdrop-blur border-t border-border grid grid-cols-4 text-[11px]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <Tab to="/m" icon={Home} label="Touren" exact />
        <Tab to="/m/heute" icon={CalendarDays} label="Heute" />
        <Tab to="/m/sync" icon={RefreshCw} label={pending ? `Sync ${pending}` : 'Sync'} />
        <Tab to="/m/profil" icon={User} label="Profil" />
      </nav>
    </div>
  );
}

function Tab({ to, icon: Icon, label, exact }: { to: string; icon: any; label: string; exact?: boolean }) {
  return (
    <NavLink
      to={to}
      end={exact}
      className={({ isActive }) =>
        `flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${
          isActive ? 'text-primary' : 'text-muted-foreground active:text-foreground'
        }`
      }
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium">{label}</span>
    </NavLink>
  );
}
