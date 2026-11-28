import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RELEASE_ROWS, releaseDashboard, type Cell, type Log } from '@/lib/phReleaseDashboard';
import { OPERATING_QUERY } from './ProductionControl';

const db = supabase as any;
const tone: Record<Cell['state'], string> = { ok: 'text-emerald-400', fail: 'text-red-400', none: 'text-muted-foreground', info: 'text-foreground' };

export function ReleaseDashboard({ canWrite, products }: { canWrite: boolean; products: { id: string; name: string }[] }) {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState('');
  const [last, setLast] = useState<any>(null);
  const { data } = useQuery({
    queryKey: [...OPERATING_QUERY, 'release-dashboard'],
    queryFn: async () => {
      const [g, l] = await Promise.all([
        db.from('ph_settings').select('value').eq('key', 'ph2_activation').maybeSingle(),
        db.from('ph_sync_log').select('operation,channel_code,status,payload,created_at').in('operation', ['ph2_release_proof', 'ph2_connection_test', 'ph2_emergency_lift', 'ph2_mode_change', 'ph2_emergency_stop']).order('created_at', { ascending: false }).limit(300),
      ]);
      if (g.error || l.error) throw g.error || l.error;
      return { gate: g.data?.value ?? {}, logs: (l.data ?? []) as Log[] };
    },
    refetchInterval: 15000,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: OPERATING_QUERY });
  const run = useMutation({
    mutationFn: async (body: Record<string, string>) => {
      const { data: r, error } = await supabase.functions.invoke('ph-release-control', { body });
      if (error) throw new Error((await (error as any).context?.json?.().catch(() => null))?.error ?? error.message);
      return r;
    },
    onSuccess: async r => { setLast(r); await refresh(); r?.passed ? toast.success('Prüfung bestanden') : toast.error(`Prüfung nicht bestanden: ${r?.result ?? r?.error ?? 'siehe Protokoll'}`); },
    onError: (e: any) => toast.error(e.message || 'Prüfung fehlgeschlagen'),
  });
  const lift = useMutation({
    mutationFn: async () => { const { error } = await db.rpc('ph2_lift_emergency_stop', { _confirmation: confirm, _revision: data?.gate?.revision ?? 0 }); if (error) throw error; },
    onSuccess: async () => { setConfirm(''); await refresh(); toast.success('Notstopp aufgehoben; Pilot und Produktivbetrieb bleiben gesperrt'); },
    onError: (e: any) => toast.error(e.message),
  });
  const gate = data?.gate ?? {};
  const name = (c: 'de' | 'com') => products.find(p => p.id === gate?.channels?.[c]?.pilot_product_id)?.name;
  const de = releaseDashboard('de', gate, data?.logs ?? [], name('de'));
  const com = releaseDashboard('com', gate, data?.logs ?? [], name('com'));
  const audit = (data?.logs ?? []).filter(l => l.operation !== 'ph2_connection_test').slice(0, 15);
  const busy = run.isPending;
  return (
    <Card><CardContent className="space-y-4 p-4">
      <div><h2 className="text-lg font-semibold">Release Control</h2>
        <p className="text-sm text-muted-foreground">Nur tatsächlich ermittelte Prüfergebnisse. Keine Prüfung schaltet Pilot- oder Produktivbetrieb frei.</p></div>
      <Table>
        <TableHeader><TableRow><TableHead>Prüfung</TableHead><TableHead>alix-lasers.de</TableHead><TableHead>alix-lasers.com</TableHead></TableRow></TableHeader>
        <TableBody>{RELEASE_ROWS.map(r => <TableRow key={r}><TableCell className="font-medium">{r}</TableCell>
          <TableCell className={tone[de[r].state]}>{de[r].text}</TableCell><TableCell className={tone[com[r].state]}>{com[r].text}</TableCell></TableRow>)}</TableBody>
      </Table>
      {canWrite && <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy} onClick={() => run.mutate({ action: 'bundle_check', channel: 'de' })}>API-Abruf DE prüfen</Button>
        <Button variant="outline" disabled={busy} onClick={() => run.mutate({ action: 'bundle_check', channel: 'com' })}>API-Abruf COM prüfen</Button>
        <Button variant="outline" disabled={busy} onClick={() => run.mutate({ action: 'backup_proof' })}>Vollsicherung prüfen</Button>
        <Button variant="outline" disabled={busy} onClick={() => run.mutate({ action: 'restore_test' })}>Wiederherstellungstest starten</Button>
      </div>}
      {busy && <p className="text-sm text-muted-foreground">Prüfung läuft …</p>}
      {last?.checks && <ul className="text-sm space-y-1">{last.checks.map((c: any) => <li key={c.name} className={c.passed ? 'text-emerald-400' : 'text-red-400'}>{c.passed ? '✓' : '✗'} {c.name}: {c.detail}</li>)}</ul>}
      {canWrite && gate.emergency_stopped !== false && <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <span className="text-sm">Notstopp manuell aufheben (nur mit Vollsicherung und Wiederherstellungstest). Bestätigung: <code>NOTSTOPP AUFHEBEN</code></span>
        <Input className="max-w-xs" value={confirm} onChange={e => setConfirm(e.target.value)} aria-label="Bestätigung Notstopp" />
        <Button variant="destructive" disabled={confirm !== 'NOTSTOPP AUFHEBEN' || lift.isPending} onClick={() => lift.mutate()}>Notstopp aufheben</Button>
      </div>}
      <div className="border-t border-border pt-3"><h3 className="text-sm font-semibold mb-2">Audit-Log Freigabeentscheidungen</h3>
        {audit.length === 0 ? <p className="text-sm text-muted-foreground">Noch keine Einträge</p> :
          <ul className="text-xs space-y-1">{audit.map((l, i) => <li key={i}>{new Date(l.created_at).toLocaleString('de-DE')} · {l.operation}{l.channel_code ? ` · ${l.channel_code.toUpperCase()}` : ''}{l.payload?.kind ? ` · ${l.payload.kind}` : ''} · {l.status}</li>)}</ul>}
      </div>
    </CardContent></Card>
  );
}
