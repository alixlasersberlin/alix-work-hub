import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Trash2, Loader2 } from 'lucide-react';
import { list as outboxList, flush, remove, OutboxItem } from '@/lib/mobile/outbox';
import { toast } from 'sonner';

export default function MobileSync() {
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [busy, setBusy] = useState(false);

  const reload = async () => setItems(await outboxList());
  useEffect(() => { reload(); }, []);

  const onSync = async () => {
    setBusy(true);
    const r = await flush();
    await reload();
    toast.success(`${r.ok} ok, ${r.failed} offen`);
    setBusy(false);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Sync-Warteschlange</h1>
        <Button onClick={onSync} disabled={busy} className="gold-gradient">
          {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
          Sync starten
        </Button>
      </div>

      {items.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">Alles synchronisiert.</Card>
      ) : items.map(it => (
        <Card key={it.id} className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium">{it.kind}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(it.created_at).toLocaleString('de-DE')} · Versuche: {it.attempts}
              </div>
              {it.last_error && <div className="text-xs text-destructive mt-1 break-all">{it.last_error}</div>}
            </div>
            <Button variant="ghost" size="icon" onClick={async () => { if (it.id) { await remove(it.id); reload(); } }}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
