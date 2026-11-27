import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const db = supabase as any;
type ChannelInfo = { receiver_url: string; signal_auth: boolean; receipt_auth: boolean };
type Overview = { live_enabled: boolean; channels: Record<string, ChannelInfo> };

const yesNo = (v: boolean | undefined) => <Badge variant={v ? 'default' : 'outline'}>{v ? 'JA' : 'NEIN'}</Badge>;
const fmt = (s?: string | null) => (s ? new Date(s).toLocaleString('de-DE') : '—');

/** Read-only technical connection overview; the only action is a harmless GET reachability test. */
export function ConnectionOverview({ canTest }: { canTest: boolean }) {
  const [sites, setSites] = useState<any[]>([]);
  const [ov, setOv] = useState<Overview | null>(null);
  const [gate, setGate] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<Record<string, string>>({});
  const [tests, setTests] = useState<Record<string, { at: string; message: string; status?: number }>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: ch } = await db.from('ph_channels').select('id,code,name,base_url,is_active').order('sort_order');
      setSites((ch || []).filter((c: any) => !['us', 'usa'].includes(c.code)));
      const { data: g } = await db.from('ph_settings').select('value').eq('key', 'ph2_activation').maybeSingle();
      setGate(g?.value?.enabled === true);
      const { data: logs } = await db.from('ph_sync_log').select('channel_code,created_at').eq('direction', 'inbound').order('created_at', { ascending: false }).limit(200);
      const lr: Record<string, string> = {};
      for (const l of logs || []) if (l.channel_code && !lr[l.channel_code]) lr[l.channel_code] = l.created_at;
      setLastReceipt(lr);
      const { data, error } = await supabase.functions.invoke('ph-signal-admin', { body: { action: 'overview' } });
      if (!error) setOv(data as Overview);
    })();
  }, []);

  const test = async (code: string) => {
    setBusy(code);
    const { data, error } = await supabase.functions.invoke('ph-signal-admin', { body: { action: 'test', channel: code } });
    setBusy(null);
    if (error) return toast.error('Verbindungstest nicht möglich');
    setTests(t => ({ ...t, [code]: { at: data.checked_at, message: data.message, status: data.http_status } }));
  };

  return (
    <Card><CardContent className="p-0 overflow-x-auto">
      <div className="px-4 pt-4 pb-2 text-sm font-medium">Technische Verbindung (PRODUCT HUB 2.0) · Produktivbetrieb gesperrt, nur Anzeige</div>
      <Table>
        <TableHeader><TableRow>
          <TableHead>Webseite</TableHead><TableHead>Domain</TableHead><TableHead>Webseiten-ID</TableHead><TableHead>Receiver-URL</TableHead>
          <TableHead>Status</TableHead><TableHead>Signal-Auth</TableHead><TableHead>Rückmeldung</TableHead><TableHead>Letzter Test</TableHead><TableHead>Produktiv</TableHead>
        </TableRow></TableHeader>
        <TableBody>{sites.map(s => {
          const info = ov?.channels?.[s.code];
          const t = tests[s.code];
          const status = !info ? 'Kein Empfänger vorgesehen' : !info.signal_auth || !info.receipt_auth ? 'Nicht angebunden' : t ? t.message : 'Bereit für Test';
          const live = !!info && ov?.live_enabled === true && gate && info.signal_auth && info.receipt_auth;
          return (
            <TableRow key={s.id}>
              <TableCell>{s.name}</TableCell>
              <TableCell className="text-xs">{s.base_url || '—'}</TableCell>
              <TableCell className="font-mono text-xs">{s.code} · {String(s.id).slice(0, 8)}</TableCell>
              <TableCell className="font-mono text-xs break-all">{info?.receiver_url || '—'}</TableCell>
              <TableCell className="text-xs">{status}{t?.status ? ` (HTTP ${t.status})` : ''}</TableCell>
              <TableCell>{info ? yesNo(info.signal_auth) : '—'}</TableCell>
              <TableCell>{info ? yesNo(info.receipt_auth) : '—'}</TableCell>
              <TableCell className="text-xs">
                {fmt(t?.at ?? lastReceipt[s.code])}
                {info && canTest && <Button size="sm" variant="ghost" disabled={busy === s.code} onClick={() => test(s.code)}>Testen</Button>}
              </TableCell>
              <TableCell><Badge variant={live ? 'default' : 'secondary'}>{live ? 'AN' : 'AUS'}</Badge></TableCell>
            </TableRow>
          );
        })}</TableBody>
      </Table>
    </CardContent></Card>
  );
}
