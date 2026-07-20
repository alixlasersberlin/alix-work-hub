import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Smartphone, BellRing, CheckCircle2, XCircle, WifiOff, Wifi, RefreshCw, Inbox as InboxIcon } from "lucide-react";
import { toast } from "sonner";
import { useAcOutbox } from "@/hooks/useAcOutbox";
import { flush as flushOutbox } from "@/lib/connect/offline-outbox";

export default function AlixConnectMobile() {
  const [installed, setInstalled] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushGranted, setPushGranted] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const { items: outboxItems, online } = useAcOutbox();

  useEffect(() => {
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true);
    setPushSupported("Notification" in window && "serviceWorker" in navigator);
    if ("Notification" in window) setPushGranted(Notification.permission === "granted");
    const h = (e: any) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);

  const install = async () => {
    if (!deferredPrompt) return toast.info("Installation über Browser-Menü → 'Zum Homescreen hinzufügen'");
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") toast.success("Installation gestartet");
    setDeferredPrompt(null);
  };

  const enablePush = async () => {
    if (!pushSupported) return toast.error("Push wird von diesem Gerät nicht unterstützt");
    const perm = await Notification.requestPermission();
    setPushGranted(perm === "granted");
    if (perm === "granted") toast.success("Push aktiviert");
    else toast.error("Erlaubnis abgelehnt");
  };

  return (
    <div className="h-full overflow-auto p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-primary" /> Mobile &amp; PWA
          <Badge variant="outline" className="ml-2">Phase 10</Badge>
        </h2>
        <p className="text-sm text-muted-foreground">Installierbare App, Push-Benachrichtigungen, Offline-fähige Inbox.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold flex items-center gap-2">
              <Smartphone className="h-4 w-4" /> Installation
            </div>
            {installed ? (
              <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Installiert</Badge>
            ) : (
              <Badge variant="outline" className="gap-1"><XCircle className="h-3 w-3" /> Browser-Modus</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            AlixWork ist als PWA installierbar. Nach Installation läuft die App wie native, inklusive App-Icon und eigenem Fenster.
          </p>
          <Button size="sm" onClick={install} disabled={installed}>App installieren</Button>
        </Card>

        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold flex items-center gap-2">
              <BellRing className="h-4 w-4" /> Push-Benachrichtigungen
            </div>
            {pushGranted ? (
              <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Aktiv</Badge>
            ) : (
              <Badge variant="outline" className="gap-1"><XCircle className="h-3 w-3" /> Deaktiviert</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Aktiviere Push, um neue Nachrichten aus Team Chat, Unified Inbox und WhatsApp-Kanälen direkt am Gerät zu erhalten.
          </p>
          <Button size="sm" onClick={enablePush} disabled={!pushSupported || pushGranted}>Push aktivieren</Button>
        </Card>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold flex items-center gap-2">
            <InboxIcon className="h-4 w-4" /> Offline-Inbox
            {online ? (
              <Badge variant="outline" className="gap-1"><Wifi className="h-3 w-3" /> Online</Badge>
            ) : (
              <Badge variant="destructive" className="gap-1"><WifiOff className="h-3 w-3" /> Offline</Badge>
            )}
          </div>
          <Badge variant="outline" className="gap-1">{outboxItems.length} in Warteschlange</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Antworten aus der Unified Inbox werden offline lokal (IndexedDB) gespeichert und automatisch gesendet, sobald wieder Verbindung besteht.
          Exponentielles Backoff, max. 8 Versuche pro Nachricht.
        </p>
        {outboxItems.length > 0 && (
          <div className="max-h-48 overflow-auto space-y-1">
            {outboxItems.map((o) => (
              <div key={o.id} className="flex items-start gap-2 rounded border border-border/50 bg-muted/40 p-2 text-xs">
                <div className="flex-1 min-w-0">
                  <div className="line-clamp-1">{o.body}</div>
                  <div className="text-[10px] text-muted-foreground">
                    Konversation {o.conversation_id.slice(0, 8)} · Versuch {o.attempts}/8
                    {o.last_error && <span className="text-destructive"> · {o.last_error}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <Button size="sm" variant="outline" onClick={async () => {
          const r = await flushOutbox();
          toast.success(`Sync: ${r.ok} versendet, ${r.failed} fehlgeschlagen, ${r.deferred} später`);
        }} disabled={!online || outboxItems.length === 0}>
          <RefreshCw className="h-3 w-3 mr-1" /> Jetzt synchronisieren
        </Button>
      </Card>

      <Card className="p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Roadmap</div>
        <ul className="text-sm space-y-1.5">
          <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-primary" /> Offline-Inbox mit lokaler Warteschlange (IndexedDB) — aktiv</li>
          <li className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/60" /> Voice-to-Text für schnelle Antworten</li>
          <li className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/60" /> Native Capacitor Builds für iOS/Android (Enterprise-Verteilung)</li>
        </ul>
      </Card>
    </div>
  );
}
