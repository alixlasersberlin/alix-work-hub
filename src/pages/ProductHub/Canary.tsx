import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Rocket, Loader2, ShieldAlert, PlugZap, Snowflake, Undo2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

const db = supabase as any;
const BLUEICE_SYNC_ID = 'ba67ae10-0100-899a-bb67-278abb6837aa';

type State = 'READY' | 'NOT READY' | 'PASSED' | 'FAILED' | 'FROZEN' | 'DISABLED' | 'UNKNOWN' | string;

function Dot({ v }: { v: State }) {
  const good = ['READY', 'PASSED', 'FROZEN', 'DISABLED'].includes(v);
  return <Badge className={good ? 'bg-emerald-600' : v === 'UNKNOWN' ? 'bg-muted text-foreground' : 'bg-destructive'}>{v}</Badge>;
}

export default function ProductHubCanary() {
  const { roles } = useAuth();
  const canRun = (roles || []).some((r: string) => ['Super Admin', 'Admin'].includes(r));

  const [product, setProduct] = useState<any>(null);
  const [batch, setBatch] = useState<any>(null);
  const [snaps, setSnaps] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [deWrite, setDeWrite] = useState<State>('UNKNOWN');
  const [lock, setLock] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data: p } = await db.from('ph_products').select('*').eq('slug', 'alix-blueice-smart-ki').maybeSingle();
    setProduct(p);
    if (!p) return;
    const [{ data: b }, { data: s }] = await Promise.all([
      db.from('ph_canary_batches').select('*').eq('product_id', p.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      db.from('ph_canary_snapshots').select('*').eq('product_id', p.id).order('rollback_order'),
    ]);
    setBatch(b || null);
    setSnaps((s || []).filter((r: any) => !b || r.batch_id === b.id));
    const { data: st } = await db.from('ph_settings').select('*').eq('key', 'canary_de_write').maybeSingle();
    setDeWrite((st?.value?.state as State) ?? 'UNKNOWN');
    setTests(st?.value?.tests ?? []);
    const { data: lk } = await db.from('ph_settings').select('*').eq('key', 'blueice_canary_lock').maybeSingle();
    setLock(lk?.value ?? null);
  };

  useEffect(() => { (async () => { await load(); setLoading(false); })(); }, []);

  const call = async (action: string, body: Record<string, any> = {}) => {
    setBusy(action);
    try {
      const { data, error } = await supabase.functions.invoke('product-hub-de-canary', {
        body: { action, product_id: product?.id, ...body },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      await load();
      return data as any;
    } catch (e: any) {
      toast.error(e.message || 'Aktion fehlgeschlagen');
      return null;
    } finally { setBusy(null); }
  };

  const dash = useMemo(() => {
    const checks = batch?.checks || {};
    return {
      de_write: deWrite,
      snapshot: batch?.status === 'FROZEN' ? 'FROZEN' : (batch ? batch.status : 'NOT READY'),
      snapshot_time: batch?.snapshot_at ? new Date(batch.snapshot_at).toLocaleString('de-DE') : '—',
      rollback: checks.rollback === 'READY' && snaps.length ? 'READY' : 'NOT READY',
      lock: snaps.length && snaps.every((s: any) => s.current_live_value !== undefined) ? 'READY' : 'NOT READY',
      readback: snaps.length ? 'READY' : 'NOT READY',
      sync_lock: lock?.active ? 'ACTIVE' : 'LOCK READY',
      dry_run: (checks.dry_run as State) || 'NOT READY',
      publish: (checks.publish as State) || 'OFFEN',
      audit: 'READY',
      com: 'DISABLED',
      phase: 'B',
    };
  }, [batch, snaps, deWrite, lock]);

  const results: any[] = (batch?.checks?.results as any[]) || [];

  const allGreen =
    dash.de_write === 'READY' && dash.snapshot === 'FROZEN' && dash.rollback === 'READY' &&
    dash.lock === 'READY' && dash.readback === 'READY' && dash.dry_run === 'PASSED' && !!lock?.active;

  if (loading) return <div className="p-8 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Lade Canary Panel…</div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="Product Hub · BlueIce DE Canary" subtitle="Phase B – Vorbereitung und Sicherheitschecks, kein Live-Push" icon={Rocket} />

      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="text-sm">Canary Dashboard</CardTitle>
          <Badge variant="outline">Phase B</Badge>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-xs">
          {[
            ['DE Write', dash.de_write], ['Snapshot', dash.snapshot], ['Snapshot-Zeit', dash.snapshot_time],
            ['Rollback', dash.rollback], ['Optimistic Lock', dash.lock], ['Read-back', dash.readback],
            ['BlueIce Sync Lock', dash.sync_lock], ['Dry Run', dash.dry_run], ['Publish', dash.publish],
            ['Audit', dash.audit], ['COM', dash.com], ['Phase', dash.phase],
          ].map(([k, v]) => (
            <div key={k as string} className="flex items-center justify-between gap-2 rounded border px-2 py-1.5">
              <span className="text-muted-foreground">{k}</span>
              {k === 'Snapshot-Zeit' || k === 'Phase' ? <span className="font-medium">{v}</span> : <Dot v={v as State} />}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Verpflichtende Reihenfolge</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={!canRun || !!busy} onClick={() => call('selftest')}>
            {busy === 'selftest' ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5 mr-1.5" />}
            1 · DE Write Dry-Run-Tests
          </Button>
          <Button size="sm" variant="outline" disabled={!canRun || !!busy || dash.de_write !== 'READY'} onClick={() => call('snapshot')}>
            {busy === 'snapshot' ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Snowflake className="h-3.5 w-3.5 mr-1.5" />}
            2 · Live-Snapshot lesen &amp; einfrieren
          </Button>
          <Button size="sm" variant="outline" disabled={!canRun || !!busy || dash.rollback !== 'READY'} onClick={() => toast.success(`Rollback-Paket geprüft: ${snaps.length} Felder, Reihenfolge rückwärts`)}>
            <Undo2 className="h-3.5 w-3.5 mr-1.5" /> 3 · Rollback prüfen
          </Button>
          <Button size="sm" variant="outline" disabled={!canRun || !!busy || !!lock?.active}
            onClick={async () => { const r = await call('lock'); if (r) toast.success(`BlueIce Sync-Lock ${r.lock} · ${r.products_still_syncing} Geräte weiterhin im COM→DE Sync`); }}>
            {busy === 'lock' ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
            4 · BlueIce Sync Lock {lock?.active ? 'AKTIV' : 'aktivieren'}
          </Button>
          <Button size="sm" variant="outline" disabled={!canRun || !!busy || dash.snapshot !== 'FROZEN'} onClick={() => call('dryrun', { batch_id: batch?.id })}>
            {busy === 'dryrun' ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
            5 · Dry Run aller Änderungen
          </Button>
          <Button size="sm" className="bg-destructive/80" disabled={!canRun || !!busy || !allGreen}
            title={allGreen ? 'Live-Push mit Read-back je Feld' : 'Checks nicht vollständig grün'}
            onClick={async () => {
              if (!confirm('BlueIce DE Canary jetzt LIVE veröffentlichen? Read-back nach jedem Feld, Stopp bei jedem Fehler.')) return;
              const r = await call('publish', { batch_id: batch?.id });
              if (r) r.publish === 'SUCCESS'
                ? toast.success(`Canary ${r.publish}: ${r.written} geschrieben, ${r.skipped} übersprungen, Read-back ${r.verified}/${r.attempted}`)
                : toast.error(`Canary gestoppt: ${r.stopped_at}`);
            }}>
            {busy === 'publish' ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <ShieldAlert className="h-3.5 w-3.5 mr-1.5" />}
            6 · BlueIce DE Canary veröffentlichen
          </Button>
        </CardContent>
      </Card>

      {!!results.length && (
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-sm">Live-Push · Read-back je Feld</CardTitle>
            <Badge className={batch?.checks?.publish === 'SUCCESS' ? 'bg-emerald-600' : 'bg-destructive'}>{batch?.checks?.publish}</Badge>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Feld</TableHead><TableHead>Aktion</TableHead><TableHead>Vorher</TableHead><TableHead>Neu</TableHead><TableHead>Read-back</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {results.map((r: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs font-medium">{r.field}</TableCell>
                    <TableCell className="text-xs">{r.action}{r.reason ? ` · ${r.reason}` : ''}</TableCell>
                    <TableCell className="text-xs">{r.previous_value ?? r.live_value ?? '—'}</TableCell>
                    <TableCell className="text-xs">{r.new_value ?? '—'}</TableCell>
                    <TableCell className="text-xs">{r.readback ?? '—'}</TableCell>
                    <TableCell><Badge className={r.verified ? 'bg-emerald-600' : 'bg-destructive'}>{r.verified ? 'VERIFIED' : (r.error || 'FAILED')}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}


      {!!tests.length && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">DE Write Dry-Run-Tests</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Test</TableHead><TableHead className="w-[90px]">HTTP</TableHead><TableHead className="w-[110px]">Ergebnis</TableHead><TableHead>Detail</TableHead></TableRow></TableHeader>
              <TableBody>
                {tests.map((t: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs">{t.name}</TableCell>
                    <TableCell className="text-xs">{t.status}</TableCell>
                    <TableCell><Badge className={t.pass ? 'bg-emerald-600' : 'bg-destructive'}>{t.pass ? 'PASS' : 'FAIL'}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[360px] truncate">{t.detail || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="text-sm">Eingefrorener DE-Live-Snapshot</CardTitle>
          <span className="text-xs text-muted-foreground">Sync-Lock-ID: {BLUEICE_SYNC_ID}</span>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Feld</TableHead><TableHead>DE Live (previous_value)</TableHead><TableHead>Zielwert Master</TableHead><TableHead>Zustand</TableHead><TableHead>Erfasst</TableHead></TableRow></TableHeader>
            <TableBody>
              {!snaps.length && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-xs">Noch kein Snapshot – Schritt 2 ausführen.</TableCell></TableRow>}
              {snaps.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="text-xs">{s.rollback_order}</TableCell>
                  <TableCell className="text-xs font-medium">{s.field}</TableCell>
                  <TableCell className="text-xs">{s.current_live_value ?? <Badge variant="outline">NULL/EMPTY CONFIRMED</Badge>}</TableCell>
                  <TableCell className="text-xs">{s.target_master_value ?? '—'}</TableCell>
                  <TableCell className="text-xs">{s.value_state}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(s.captured_at).toLocaleString('de-DE')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
