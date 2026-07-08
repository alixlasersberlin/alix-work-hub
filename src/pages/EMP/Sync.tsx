import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { list, pending, syncAll, clearSynced, conflicts } from '@/lib/emp/offline';
import { useState } from 'react';
import { toast } from 'sonner';
import { RefreshCw, Trash2, AlertTriangle } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/emp/useOnlineStatus';

export default function EmpSync() {
  const [, setTick] = useState(0);
  const online = useOnlineStatus();
  const all = list();
  const p = pending();
  const c = conflicts();

  const run = async () => {
    const r = await syncAll();
    toast.success(`Synchronisiert: ${r.ok} · Fehler: ${r.fail}`);
    setTick((t) => t + 1);
  };

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <div className="text-sm font-medium">Status</div>
        <div className="text-xs text-muted-foreground mt-1">
          Verbindung: {online ? 'Online' : 'Offline'} · Warteschlange: {p.length} · Gesamt: {all.length} · Konflikte: {c.length}
        </div>
        <div className="flex gap-2 mt-3">
          <Button size="sm" onClick={run} disabled={!online}><RefreshCw className="h-4 w-4 mr-1" />Jetzt synchronisieren</Button>
          <Button size="sm" variant="outline" onClick={() => { clearSynced(); setTick((t) => t + 1); toast.success('Bereinigt'); }}><Trash2 className="h-4 w-4 mr-1" />Bereinigen</Button>
        </div>
      </Card>

      {c.length > 0 && (
        <Card className="p-3 border-amber-500/40">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-500"><AlertTriangle className="h-4 w-4" />Konflikte</div>
          <ul className="text-xs mt-2 space-y-1">
            {c.map((e) => <li key={e.id}>{e.kind}: {e.conflict}</li>)}
          </ul>
        </Card>
      )}

      <Card className="p-3">
        <div className="text-sm font-medium mb-2">Outbox</div>
        <ul className="text-xs space-y-1 max-h-96 overflow-auto">
          {all.slice(-30).reverse().map((e) => (
            <li key={e.id} className="flex justify-between gap-2 border-b border-border/50 py-1">
              <span>{e.kind}</span>
              <span className="text-muted-foreground">{e.synced ? '✓' : '…'} {new Date(e.createdAt).toLocaleTimeString()}</span>
            </li>
          ))}
          {all.length === 0 && <li className="text-muted-foreground">Keine Einträge</li>}
        </ul>
      </Card>
    </div>
  );
}
