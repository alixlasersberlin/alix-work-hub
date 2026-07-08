import { Outlet, useNavigate } from 'react-router-dom';
import BottomNav from './BottomNav';
import { useEmpPersona } from '@/hooks/emp/useEmpPersona';
import { useOnlineStatus } from '@/hooks/emp/useOnlineStatus';
import { WifiOff, Wifi, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function EmpLayout() {
  const { label } = useEmpPersona();
  const online = useOnlineStatus();
  const nav = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header
        className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur px-3 py-2 flex items-center gap-2"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}
      >
        <Button variant="ghost" size="icon" onClick={() => nav(-1)} aria-label="Zurück">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none">AlixWorks · Mobile</div>
          <div className="text-sm font-semibold leading-tight">{label}</div>
        </div>
        <div
          className={`flex items-center gap-1 text-xs rounded-full px-2 py-1 border ${
            online ? 'text-emerald-500 border-emerald-500/30' : 'text-amber-500 border-amber-500/30'
          }`}
          title={online ? 'Online' : 'Offline'}
        >
          {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{online ? 'Online' : 'Offline'}</span>
        </div>
      </header>

      <main className="flex-1 pb-24 max-w-2xl w-full mx-auto px-3 py-3">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  );
}
