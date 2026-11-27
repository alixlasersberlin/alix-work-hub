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

type FullTest = { checked_at: string; reachable: boolean; auth_required: boolean; signature: string; receipt: boolean; result: string; message: string; http_get: number | null; http_unsigned: number | null; http_signed: number | null; response_ms?: number };
const SIG: Record<string, string> = { verified: 'Signatur erfolgreich geprüft', rejected: 'Signatur abgelehnt', unsupported: 'Testsignal nicht unterstützt', unknown: 'Nicht geprüft' };
const RESULT: Record<string, { label: string; v: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  accepted: { label: 'Technische Abnahme erfolgreich', v: 'default' }, signature_ok: { label: 'Signatur erfolgreich geprüft', v: 'secondary' },
  auth_required: { label: 'Authentifizierung erforderlich', v: 'outline' }, reachable: { label: 'Empfänger erreichbar', v: 'outline' },
  error: { label: 'Verbindungsfehler', v: 'destructive' },
};
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
  const [protocol, setProtocol] = useState<Record<string, FullTest>>({});

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
      const { data: ft } = await db.from('ph_sync_log').select('channel_code,payload').eq('operation', 'ph2_connection_test').order('created_at', { ascending: false }).limit(20);
      const pr: Record<string, FullTest> = {};
      for (const r of ft || []) if (r.channel_code && !pr[r.channel_code]) pr[r.channel_code] = r.payload;
      setProtocol(pr);
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

  const fullTest = async (code: string) => {
    setBusy(code);
    const { data, error } = await supabase.functions.invoke('ph-signal-admin', { body: { action: 'full_test', channel: code } });
    setBusy(null);
    if (error || !data) return toast.error('Vollständiger Verbindungstest nicht möglich');
    setProtocol(p => ({ ...p, [code]: data as FullTest }));
  };

  return (
    <div className="space-y-4">
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
    <Card><CardContent className="p-0 overflow-x-auto">
      <div className="px-4 pt-4 pb-2 text-sm font-medium">Technisches Testprotokoll · Testsignal ohne Produktdaten, unabhängig vom Produktivbetrieb</div>
      <Table>
        <TableHeader><TableRow>
          <TableHead>Webseite</TableHead><TableHead>Datum/Uhrzeit</TableHead><TableHead>Erreichbarkeit</TableHead><TableHead>HTTP-Status</TableHead>
          <TableHead>Signaturprüfung</TableHead><TableHead>Rückmeldung</TableHead><TableHead>Antwortzeit</TableHead><TableHead>Ergebnis</TableHead><TableHead>Beschreibung</TableHead><TableHead />
        </TableRow></TableHeader>
        <TableBody>{['com', 'de'].map(code => {
          const p = protocol[code];
          const r = p ? RESULT[p.result] ?? RESULT.error : null;
          return (
            <TableRow key={code}>
              <TableCell className="font-mono text-xs">{code}</TableCell>
              <TableCell className="text-xs">{fmt(p?.checked_at)}</TableCell>
              <TableCell>{p ? <Badge variant={p.reachable ? 'default' : 'destructive'}>{p.reachable ? 'Empfänger erreichbar' : 'Verbindungsfehler'}</Badge> : '—'}</TableCell>
              <TableCell className="text-xs font-mono">{p ? `GET ${p.http_get ?? '—'} · unsigniert ${p.http_unsigned ?? '—'} · signiert ${p.http_signed ?? '—'}` : '—'}</TableCell>
              <TableCell className="text-xs">{p ? SIG[p.signature] : '—'}</TableCell>
              <TableCell className="text-xs">{p ? (p.receipt ? 'Rückmeldung erfolgreich empfangen' : 'Keine Rückmeldung') : '—'}</TableCell>
              <TableCell className="text-xs">{p?.response_ms != null ? `${p.response_ms} ms` : '—'}</TableCell>
              <TableCell>{r ? <Badge variant={r.v}>{r.label}</Badge> : '—'}</TableCell>
              <TableCell className="text-xs max-w-xs">{p?.message ?? 'Noch kein vollständiger Test'}</TableCell>
              <TableCell>{canTest && ov?.channels?.[code] && <Button size="sm" variant="outline" disabled={busy === code} onClick={() => fullTest(code)}>{busy === code ? 'Prüfe…' : 'Vollständiger Verbindungstest'}</Button>}</TableCell>
            </TableRow>
          );
        })}</TableBody>
      </Table>
    </CardContent></Card>
    </div>
  );
}
