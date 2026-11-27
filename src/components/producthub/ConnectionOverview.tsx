import { useQuery } from '@tanstack/react-query';
import { OPERATING_QUERY } from './ProductionControl';
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CHECK_LABELS, evaluateChecks, failureCause, allReady, type CheckKey } from '@/lib/phAcceptance';

const db = supabase as any;
type ChannelInfo = { receiver_url: string; signal_auth: boolean; receipt_auth: boolean };
type Overview = { live_enabled: boolean; channels: Record<string, ChannelInfo> };

type FullTest = { checked_at: string; reachable: boolean; auth_required: boolean; signature: string; receipt: boolean; result: string; message: string; http_get: number | null; http_unsigned: number | null; http_signed: number | null; response_ms?: number; test_id?: string };
const SIG: Record<string, string> = { verified: 'Signatur erfolgreich geprüft', rejected: 'Signatur abgelehnt', unsupported: 'Testsignal nicht unterstützt', unknown: 'Nicht geprüft' };
const RESULT: Record<string, { label: string; v: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  accepted: { label: 'Technische Abnahme erfolgreich', v: 'default' }, signature_ok: { label: 'Signatur erfolgreich geprüft', v: 'secondary' },
  auth_required: { label: 'Authentifizierung erforderlich', v: 'outline' }, reachable: { label: 'Empfänger erreichbar', v: 'outline' },
  error: { label: 'Verbindungsfehler', v: 'destructive' },
};
const yesNo = (v: boolean | undefined) => <Badge variant={v ? 'default' : 'outline'}>{v ? 'JA' : 'NEIN'}</Badge>;
const ACCEPT = ['de', 'com'];
const SITE_NAMES: Record<string, string> = { de: 'alix-lasers.de', com: 'alix-lasers.com' };
const fmt = (s?: string | null) => (s ? new Date(s).toLocaleString('de-DE') : '—');

/** Technical connection overview: GET reachability test and the content-free signed full connection test (no product writes). */
export function ConnectionOverview({ canTest }: { canTest: boolean }) {
  const [sites, setSites] = useState<any[]>([]);
  const [ov, setOv] = useState<Overview | null>(null);
  const [gate, setGate] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<Record<string, string>>({});
  const [tests, setTests] = useState<Record<string, { at: string; message: string; status?: number }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [protocol, setProtocol] = useState<Record<string, FullTest>>({});
  const [lastOk, setLastOk] = useState<Record<string, string>>({});
  const [allBusy, setAllBusy] = useState(false);
  const { data: operatingGate } = useQuery({ queryKey: [...OPERATING_QUERY, 'connection-status'], queryFn: async () => { const { data, error } = await db.from('ph_settings').select('value').eq('key', 'ph2_activation').maybeSingle(); if (error) throw error; return data?.value ?? {}; }, refetchInterval: 10000 });
  const siteLive = (code: string) => ov?.live_enabled === true && operatingGate?.enabled === true && operatingGate?.emergency_stopped === false && ['pilot','full'].includes(operatingGate?.channels?.[code]?.mode);

  const loadProtocol = async () => {
    const { data: ft } = await db.from('ph_sync_log').select('channel_code,payload,created_at').eq('operation', 'ph2_connection_test').order('created_at', { ascending: false }).limit(200);
    const pr: Record<string, FullTest> = {}; const lo: Record<string, string> = {};
    for (const r of ft || []) {
      if (!r.channel_code) continue;
      if (!pr[r.channel_code]) pr[r.channel_code] = { ...r.payload, checked_at: r.payload?.checked_at ?? r.created_at };
      if (!lo[r.channel_code] && r.payload?.result === 'accepted') lo[r.channel_code] = r.payload?.checked_at ?? r.created_at;
    }
    setProtocol(pr); setLastOk(lo);
  };

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
      await loadProtocol();
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
    const res = { ...(data as FullTest), checked_at: (data as FullTest).checked_at ?? new Date().toISOString() };
    setProtocol(p => ({ ...p, [code]: res }));
    if (res.result === 'accepted') toast.success('Technische Abnahme erfolgreich'); else toast.error(res.message || 'Verbindungstest fehlgeschlagen');
    await loadProtocol().catch(() => {});
  };

  // Each site is tested independently; one failure never stops the other. Display only — never enables production.
  const testAll = async () => {
    setAllBusy(true);
    const res = await Promise.allSettled(ACCEPT.map(async code => {
      const { data, error } = await supabase.functions.invoke('ph-signal-admin', { body: { action: 'full_test', channel: code } });
      if (error || !data) throw new Error(code);
      return data as FullTest;
    }));
    await loadProtocol().catch(() => {});
    setAllBusy(false);
    const failed = res.map((r, i) => (r.status === 'rejected' || (r as any).value?.result !== 'accepted' ? ACCEPT[i].toUpperCase() : null)).filter(Boolean);
    failed.length ? toast.error(`Abnahme nicht bestanden: ${failed.join(', ')}`) : toast.success('Beide Webseiten technisch abgenommen');
  };
  const ready = allReady(ACCEPT, protocol);
  const live = ov?.live_enabled === true && gate;
  const mark = (v: boolean | null) => v === null ? <Badge variant="outline">—</Badge> : v ? <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">OK</Badge> : <Badge variant="destructive">Fehler</Badge>;

  return (
    <div className="space-y-4">
    <Card><CardContent className="p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium">Zentrale Statusübersicht · Abschließende technische Abnahme</div>
        {canTest && <Button size="sm" disabled={allBusy || !!busy} onClick={testAll}>{allBusy ? 'Teste…' : 'Alle Webseiten vollständig testen'}</Button>}
      </div>
      <div className={`rounded-md border px-3 py-2 text-sm font-semibold ${ready ? 'border-emerald-600 bg-emerald-600/15 text-emerald-500' : 'border-amber-600 bg-amber-600/10 text-amber-500'}`}>
        {ready ? 'PRODUCT HUB – Technisch betriebsbereit' : 'PRODUCT HUB – Technische Abnahme ausstehend'}
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Prüfung</TableHead>{ACCEPT.map(c => <TableHead key={c}>{SITE_NAMES[c]}</TableHead>)}</TableRow></TableHeader>
        <TableBody>
          {(Object.keys(CHECK_LABELS) as CheckKey[]).map(k => <TableRow key={k}><TableCell className="text-xs">{CHECK_LABELS[k]}</TableCell>{ACCEPT.map(c => <TableCell key={c}>{mark(evaluateChecks(protocol[c])[k])}</TableCell>)}</TableRow>)}
          <TableRow><TableCell className="text-xs">Antwortzeit</TableCell>{ACCEPT.map(c => <TableCell key={c} className="text-xs font-mono">{protocol[c]?.response_ms != null ? `${protocol[c].response_ms} ms` : '—'}</TableCell>)}</TableRow>
          <TableRow><TableCell className="text-xs">Letzter erfolgreicher Verbindungstest</TableCell>{ACCEPT.map(c => <TableCell key={c} className="text-xs">{fmt(lastOk[c])}</TableCell>)}</TableRow>
          <TableRow><TableCell className="text-xs">Technische Abnahme</TableCell>{ACCEPT.map(c => { const cause = failureCause(protocol[c]); return <TableCell key={c} className="text-xs">{cause ? <span className="text-destructive">{SITE_NAMES[c]}: {cause}</span> : <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Erfolgreich</Badge>}</TableCell>; })}</TableRow>
          <TableRow><TableCell className="text-xs">Status des Produktivbetriebs</TableCell>{ACCEPT.map(c => <TableCell key={c}><Badge variant={siteLive(c) ? 'default' : 'secondary'}>{siteLive(c) ? operatingGate.channels[c].mode === 'pilot' ? 'PILOT' : 'VOLLSTÄNDIG' : 'GESPERRT'}</Badge></TableCell>)}</TableRow>
        </TableBody>
      </Table>
      <div className="text-xs text-muted-foreground">Eine erfolgreiche Abnahme schaltet den Produktivbetrieb nicht frei; die Freigabe erfolgt ausschließlich manuell durch einen Super Admin.</div>
    </CardContent></Card>
    <Card><CardContent className="p-0 overflow-x-auto">
      <div className="px-4 pt-4 pb-2 text-sm font-medium">Technische Verbindung (PRODUCT HUB 2.0) · Abnahme aktiviert keinen Produktivbetrieb</div>
      <Table>
        <TableHeader><TableRow>
          <TableHead>Webseite</TableHead><TableHead>Domain</TableHead><TableHead>Webseiten-ID</TableHead><TableHead>Receiver-URL</TableHead>
          <TableHead>Status</TableHead><TableHead>Signal-Auth</TableHead><TableHead>Rückmeldung</TableHead><TableHead>Letzter Test</TableHead><TableHead>Produktiv</TableHead><TableHead>Aktionen</TableHead>
        </TableRow></TableHeader>
        <TableBody>{sites.map(s => {
          const info = ov?.channels?.[s.code];
          const t = tests[s.code];
          const p = protocol[s.code];
          const fullNewer = !!p?.checked_at && (!t || new Date(p.checked_at) >= new Date(t.at));
          const status = !info ? 'Kein Empfänger vorgesehen' : !info.signal_auth || !info.receipt_auth ? 'Nicht angebunden' : fullNewer ? (p.result === 'accepted' ? 'Technische Abnahme erfolgreich' : p.message) : t ? t.message : 'Bereit für Test';
          const ok = fullNewer && p?.result === 'accepted';
          const live = !!info && siteLive(s.code) && info.signal_auth && info.receipt_auth;
          return (
            <TableRow key={s.id}>
              <TableCell>{s.name}</TableCell>
              <TableCell className="text-xs">{s.base_url || '—'}</TableCell>
              <TableCell className="font-mono text-xs">{s.code} · {String(s.id).slice(0, 8)}</TableCell>
              <TableCell className="font-mono text-xs break-all">{info?.receiver_url || '—'}</TableCell>
              <TableCell className="text-xs">{ok ? <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Technische Abnahme erfolgreich</Badge> : <>{status}{!fullNewer && t?.status ? ` (HTTP ${t.status})` : ''}{fullNewer && p ? ` (GET ${p.http_get ?? '—'} · unsigniert ${p.http_unsigned ?? '—'} · signiert ${p.http_signed ?? '—'})` : ''}</>}</TableCell>
              <TableCell>{info ? yesNo(info.signal_auth) : '—'}</TableCell>
              <TableCell>{info ? yesNo(info.receipt_auth) : '—'}</TableCell>
              <TableCell className="text-xs">
                {fmt(fullNewer ? p?.checked_at : t?.at ?? lastReceipt[s.code])}
              </TableCell>
              <TableCell><Badge variant={live ? 'default' : 'secondary'}>{live ? 'AN' : 'AUS'}</Badge></TableCell>
              <TableCell>
                {info && canTest && <div className="flex flex-col gap-1 min-w-[190px]">
                  <Button size="sm" variant="outline" disabled={busy === s.code} onClick={() => test(s.code)}>Erreichbarkeit testen</Button>
                  {['de', 'com'].includes(s.code) && <Button size="sm" disabled={busy === s.code} onClick={() => fullTest(s.code)}>{busy === s.code ? 'Prüfe…' : 'Vollständiger Verbindungstest'}</Button>}
                </div>}
              </TableCell>
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
              <TableCell>{r ? <Badge variant={r.v} className={p?.result === 'accepted' ? 'bg-emerald-600 text-white hover:bg-emerald-600' : ''}>{r.label}</Badge> : '—'}</TableCell>
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
