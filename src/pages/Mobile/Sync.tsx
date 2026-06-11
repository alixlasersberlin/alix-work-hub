import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Trash2, Loader2, Camera, FileSignature, ClipboardCheck, Route as RouteIcon, AlertCircle } from 'lucide-react';
import { list as outboxList, flush, remove, OutboxItem } from '@/lib/mobile/outbox';
import { toast } from 'sonner';

const KIND_META: Record<string, { icon: any; label: string }> = {
  photo: { icon: Camera, label: 'Foto' },
  signature: { icon: FileSignature, label: 'Signatur' },
  checklist_run: { icon: ClipboardCheck, label: 'Checkliste' },
  route_status: { icon: RouteIcon, label: 'Status' },
};

export default function MobileSync() {
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);

  const reload = async () => setItems(await outboxList());
  useEffect(() => {
    reload();
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const onSync = async () => {
    if (!online) { toast.error('Offline – Sync nicht möglich.'); return; }
    setBusy(true);
    const r = await flush();
    await reload();
    toast.success(`${r.ok} ok · ${r.failed} offen`);
    setBusy(false);
  };

  const failed = items.filter(i => i.attempts > 0).length;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Sync</h1>
          <p className="text-xs text-muted-foreground">{items.length} ausstehend{failed ? ` · ${failed} mit Fehler` : ''}</p>
        </div>
        <Button onClick={onSync} disabled={busy || !online} className="gold-gradient">
          {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
          Sync starten
        </Button>
      </div>

      {items.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Alles synchronisiert.
        </Card>
      ) : items.map(it => {
        const meta = KIND_META[it.kind] || { icon: AlertCircle, label: it.kind };
        const Icon = meta.icon;
        return (
          <Card key={it.id} className="p-3">
            <div className="flex items-start gap-3">
              <Icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{meta.label}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(it.created_at).toLocaleString('de-DE')}
                  {it.attempts > 0 && <span className="text-destructive"> · {it.attempts} Versuch(e)</span>}
                </div>
                {it.last_error && (
                  <div className="text-xs text-destructive mt-1 break-all bg-destructive/5 rounded p-1.5">
                    {it.last_error}
                  </div>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={async () => { if (it.id != null) { await remove(it.id); reload(); } }}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
