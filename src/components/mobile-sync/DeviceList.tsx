import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Ban, KeyRound, Play, Smartphone, Trash2 } from 'lucide-react';
import { DEVICE_STATUS_LABELS, MobileDevice, deleteDevice, rotateDeviceToken, setDeviceStatus } from '@/lib/mobile-sync';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function DeviceList({ userId, refreshKey, showUser }: { userId?: string; refreshKey?: number; showUser?: boolean }) {
  const [rows, setRows] = useState<(MobileDevice & { email?: string | null })[]>([]);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<MobileDevice | null>(null);

  const load = async () => {
    let q = supabase.from('mobile_sync_devices')
      .select('id, user_id, device_name, status, last_sync_at, contact_count, created_at, token_prefix')
      .order('created_at', { ascending: false });
    if (userId) q = q.eq('user_id', userId);
    const { data } = await q;
    let list = (data ?? []) as MobileDevice[];
    if (showUser && list.length) {
      const { data: profs } = await supabase.from('user_profiles').select('id, email').in('id', [...new Set(list.map((d) => d.user_id))]);
      const map = new Map((profs ?? []).map((p: any) => [p.id, p.email]));
      list = list.map((d) => ({ ...d, email: map.get(d.user_id) })) as any;
    }
    setRows(list as any);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [userId, refreshKey]);

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try { await fn(); toast.success(msg); load(); } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-[14px] flex items-center gap-2"><Smartphone className="w-4 h-4" /> Mobile Geräte</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-[13px]">
        {newToken && (
          <div className="rounded border border-primary/40 bg-primary/5 p-3 font-mono text-[13px] break-all">
            Neues Token: {newToken}
          </div>
        )}
        {rows.map((d) => (
          <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border px-3 py-2">
            <div className="min-w-0">
              <div className="font-medium flex items-center gap-2">
                {d.device_name}
                <Badge variant={d.status === 'active' ? 'default' : 'destructive'}>{DEVICE_STATUS_LABELS[d.status] ?? d.status}</Badge>
              </div>
              <div className="text-[11px] text-muted-foreground">
                {showUser && d.email ? `${d.email} · ` : ''}
                Kontakte: {d.contact_count} · Letzte Synchronisierung:{' '}
                {d.last_sync_at ? new Date(d.last_sync_at).toLocaleString('de-DE') : 'nie'}
              </div>
            </div>
            <div className="flex gap-1">
              {d.status === 'active' ? (
                <Button size="sm" variant="outline" onClick={() => act(() => setDeviceStatus(d.id, 'blocked'), 'Gerät gesperrt')}>
                  <Ban className="w-4 h-4 mr-1" /> Sperren
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => act(() => setDeviceStatus(d.id, 'active'), 'Gerät aktiviert')}>
                  <Play className="w-4 h-4 mr-1" /> Aktivieren
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => act(async () => { const r = await rotateDeviceToken(d.id); setNewToken(r.token); }, 'Token erneuert')}>
                <KeyRound className="w-4 h-4 mr-1" /> Token erneuern
              </Button>
              <Button size="sm" variant="destructive" onClick={() => act(() => setDeviceStatus(d.id, 'revoked'), 'Zugang widerrufen')}>
                Widerrufen
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setToDelete(d)}>
                <Trash2 className="w-4 h-4 mr-1" /> Löschen
              </Button>
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="text-muted-foreground text-[12px]">Noch keine Geräte verbunden.</div>}

        <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Gerät löschen?</AlertDialogTitle>
              <AlertDialogDescription>
                „{toDelete?.device_name}“ wird dauerhaft entfernt. Das Token verliert sofort seine Gültigkeit und
                die Kontaktsynchronisation auf diesem Gerät funktioniert nicht mehr.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => { const id = toDelete!.id; setToDelete(null); act(() => deleteDevice(id), 'Gerät gelöscht'); }}
              >
                Endgültig löschen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
