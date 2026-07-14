import { Outlet, useNavigate } from 'react-router-dom';
import KalenderBottomNav from './KalenderBottomNav';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Wifi, WifiOff, CalendarCheck2 } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function KalenderLayout() {
  const nav = useNavigate();
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true); const off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === 'kalender-nav' && typeof e.data.url === 'string') nav(e.data.url);
    };
    navigator.serviceWorker?.addEventListener?.('message', onMsg);
    return () => navigator.serviceWorker?.removeEventListener?.('message', onMsg);
  }, [nav]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header
        className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur px-3 py-2 flex items-center gap-2"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}
      >
        <Button variant="ghost" size="icon" onClick={() => nav(-1)} aria-label="Zurück">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 flex items-center gap-2">
          <CalendarCheck2 className="h-5 w-5 text-primary" />
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none">AlixWork · Mobile</div>
            <div className="text-sm font-semibold leading-tight">Kalender</div>
          </div>
        </div>
        <div
          className={`flex items-center gap-1 text-xs rounded-full px-2 py-1 border ${
            online ? 'text-emerald-500 border-emerald-500/30' : 'text-amber-500 border-amber-500/30'
          }`}
        >
          {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
        </div>
      </header>

      <main className="flex-1 pb-24 max-w-2xl w-full mx-auto px-3 py-3">
        <Outlet />
      </main>

      <KalenderBottomNav />
    </div>
  );
}
