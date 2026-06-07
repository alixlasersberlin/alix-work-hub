import { ReactNode, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Home, ClipboardList, Camera, FileSignature, FileText, RefreshCw, Wifi, WifiOff, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { startAutoSync, flush, list as outboxList } from '@/lib/mobile/outbox';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function MobileLayout({ children }: { children?: ReactNode }) {
  const { profile, signOut } = useAuth();
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(0);
  const location = useLocation();

  useEffect(() => {
    startAutoSync();
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    const t = setInterval(async () => { setPending((await outboxList()).length); }, 5000);
    outboxList().then(l => setPending(l.length));
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); clearInterval(t); };
  }, []);

  const onSync = async () => {
    const r = await flush();
    setPending((await outboxList()).length);
    toast.success(`Sync: ${r.ok} ok, ${r.failed} offen`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-30 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <Link to="/m" className="font-display font-bold gold-text text-lg">Alix Mobile</Link>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden xs:inline">{profile?.full_name}</span>
          {online ? <Wifi className="w-4 h-4 text-emerald-500" /> : <WifiOff className="w-4 h-4 text-destructive" />}
          <Button size="sm" variant="ghost" onClick={onSync} className="relative">
            <RefreshCw className="w-4 h-4" />
            {pending > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] rounded-full px-1.5">
                {pending}
              </span>
            )}
          </Button>
          <Button size="sm" variant="ghost" onClick={signOut}><LogOut className="w-4 h-4" /></Button>
        </div>
      </header>

      <main className="flex-1 pb-20">
        {children ?? <Outlet />}
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-30 bg-card border-t border-border grid grid-cols-4 text-xs">
        <Tab to="/m" icon={Home} label="Touren" exact />
        <Tab to="/m/heute" icon={ClipboardList} label="Heute" />
        <Tab to="/m/sync" icon={RefreshCw} label={`Sync${pending ? ` (${pending})` : ''}`} />
        <Tab to="/m/profil" icon={FileText} label="Profil" />
      </nav>
    </div>
  );
}

function Tab({ to, icon: Icon, label, exact }: { to: string; icon: any; label: string; exact?: boolean }) {
  return (
    <NavLink to={to} end={exact}
      className={({ isActive }) =>
        `flex flex-col items-center justify-center py-2 gap-0.5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
      <Icon className="w-5 h-5" />
      <span>{label}</span>
    </NavLink>
  );
}
