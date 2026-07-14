import { Outlet, useNavigate } from 'react-router-dom';
import KalenderBottomNav from './KalenderBottomNav';
import EscalationOverlay from './EscalationOverlay';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Wifi, WifiOff, CalendarCheck2, CloudUpload, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import { useOfflineKalenderQueue } from '@/hooks/useOfflineKalenderQueue';
import { toast } from 'sonner';

export default function KalenderLayout() {
  const nav = useNavigate();
  const { count, online, syncing, runSync } = useOfflineKalenderQueue();

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === 'kalender-nav' && typeof e.data.url === 'string') nav(e.data.url);
    };
    navigator.serviceWorker?.addEventListener?.('message', onMsg);
    return () => navigator.serviceWorker?.removeEventListener?.('message', onMsg);
  }, [nav]);

  const handleSync = async () => {
    if (!online) { toast.error('Kein Netz – Sync nicht möglich'); return; }
    const r = await runSync();
    if (r.ok || r.failed) toast.success(`Sync: ${r.ok} übertragen${r.failed ? `, ${r.failed} fehlgeschlagen` : ''}`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <EscalationOverlay />
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
        {count > 0 && (
          <button
            onClick={handleSync}
            className="flex items-center gap-1 text-xs rounded-full px-2 py-1 border border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
            aria-label={`${count} ausstehende Aktionen synchronisieren`}
          >
            {syncing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CloudUpload className="h-3.5 w-3.5" />}
            <span>{count}</span>
          </button>
        )}
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
