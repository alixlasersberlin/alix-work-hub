import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Download, Share, X } from 'lucide-react';

const HIDE_KEY = 'alixKalender.installPromptHidden';

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
}
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as any).standalone === true;
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(HIDE_KEY) === 'permanent') return;
    const laterAt = Number(localStorage.getItem(HIDE_KEY) || 0);
    if (laterAt && Date.now() - laterAt < 24 * 3600 * 1000) return;

    if (isIOS()) { setVisible(true); return; }

    const handler = (e: any) => { e.preventDefault(); setDeferred(e); setVisible(true); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!visible) return null;

  const install = async () => {
    if (isIOS()) { setShowIOSHelp(true); return; }
    if (!deferred) return;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') {
      localStorage.setItem(HIDE_KEY, 'permanent');
      setVisible(false);
    }
  };

  return (
    <Card className="p-4 mb-3 border-primary/40 bg-primary/5">
      {!showIOSHelp ? (
        <div className="flex items-start gap-3">
          <Download className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">AlixWork Kalender auf diesem Gerät installieren</div>
            <div className="text-xs text-muted-foreground mt-0.5">Schnellzugriff vom Home-Bildschirm, Push-Erinnerungen und Vollbildmodus.</div>
            <div className="flex flex-wrap gap-2 mt-3">
              <Button size="sm" onClick={install}>App installieren</Button>
              <Button size="sm" variant="ghost" onClick={() => { localStorage.setItem(HIDE_KEY, String(Date.now())); setVisible(false); }}>Später</Button>
              <Button size="sm" variant="ghost" onClick={() => { localStorage.setItem(HIDE_KEY, 'permanent'); setVisible(false); }}>Nicht mehr anzeigen</Button>
            </div>
          </div>
          <Button size="icon" variant="ghost" onClick={() => setVisible(false)} aria-label="Schließen">
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          <div className="font-semibold flex items-center gap-2"><Share className="h-4 w-4" /> Installation auf iPhone / iPad</div>
          <ol className="list-decimal ml-5 text-xs space-y-1 text-muted-foreground">
            <li>Tippe unten auf das Teilen-Symbol.</li>
            <li>Wähle „Zum Home-Bildschirm".</li>
            <li>Bestätige mit „Hinzufügen".</li>
          </ol>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => { localStorage.setItem(HIDE_KEY, 'permanent'); setVisible(false); }}>Verstanden</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
