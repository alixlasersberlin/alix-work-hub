import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Smartphone, Contact, ShieldCheck } from 'lucide-react';
import { DeviceList } from '@/components/mobile-sync/DeviceList';
import { IphoneConnectDialog } from '@/components/mobile-sync/IphoneConnectDialog';
import { CARDDAV_SERVER_HOST, CARDDAV_PATH, SCOPE_LABELS, SyncScope, previewContacts } from '@/lib/mobile-sync';

export default function MobileGeraete() {
  const { profile } = useAuth();
  const [scope, setScope] = useState<SyncScope>('none');
  const [enabled, setEnabled] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('mobile_sync_settings').select('enabled, scope').eq('user_id', user.id).maybeSingle();
      setScope(((data?.scope as SyncScope) ?? 'none'));
      setEnabled(!!data?.enabled);
      if (data?.enabled) {
        try { setCount((await previewContacts()).count); } catch { setCount(null); }
      }
    })();
  }, [refreshKey]);

  return (
    <div className="p-6 space-y-4 overflow-y-auto h-full max-w-4xl">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><Smartphone className="w-5 h-5 text-primary" /> Mobile Geräte</h1>
        <p className="text-[13px] text-muted-foreground">iPhone-Kontaktsynchronisation über CardDAV – AlixWork bleibt das führende System.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-[14px] flex items-center gap-2"><Contact className="w-4 h-4" /> Meine Freigabe</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-[13px]">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={enabled ? 'default' : 'outline'}>{enabled ? 'Kontaktsynchronisierung aktiv' : 'Nicht freigegeben'}</Badge>
            <Badge variant="outline">{SCOPE_LABELS[scope]}</Badge>
            {count !== null && <Badge variant="outline">{count.toLocaleString('de-DE')} Kontakte freigegeben</Badge>}
          </div>
          {!enabled && (
            <div className="text-muted-foreground text-[12px]">
              Die Freigabe wird vom Administrator unter <b>Administration → Mobile Sync</b> erteilt.
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={() => setOpen(true)} disabled={!enabled}>
              <Smartphone className="w-4 h-4 mr-1" /> iPhone verbinden
            </Button>
          </div>
          <div className="rounded border border-border p-3 text-[12px] text-muted-foreground space-y-1">
            <div className="flex items-center gap-1 font-medium text-foreground"><ShieldCheck className="w-3 h-3" /> Sicherheit</div>
            <div>Server: <span className="font-mono">{CARDDAV_SERVER_HOST}{CARDDAV_PATH}</span> (nur HTTPS)</div>
            <div>Nur Name, Firma, Telefon, E-Mail, Adresse, Kundennummer und Ansprechpartner werden übertragen – keine Zahlungs-, Bank-, Vertrags- oder Bonitätsdaten.</div>
            <div>Der Zugang gilt pro Gerät und kann jederzeit gesperrt oder widerrufen werden.</div>
          </div>
        </CardContent>
      </Card>

      <DeviceList userId={profile?.id} refreshKey={refreshKey} />

      <IphoneConnectDialog
        open={open}
        onOpenChange={setOpen}
        email={profile?.email ?? ''}
        onCreated={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
