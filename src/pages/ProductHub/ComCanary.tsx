import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Globe, Loader2, PlugZap, Snowflake, Rocket, Undo2, ScanSearch } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

const COM_BLUEICE_ID = 'c9f9b7c9-d6b7-4ed6-ac60-913cbdec2dd6';

function Dot({ v }: { v: string }) {
  const good = ['READY', 'PASSED', 'FROZEN', 'SUCCESS', 'ACTIVE', 'NOT_REQUIRED', 'COM WEBSITE RENDER OK'].includes(v);
  const neutral = ['UNKNOWN', 'OFFEN', '—'].includes(v);
  return <Badge className={good ? 'bg-emerald-600' : neutral ? 'bg-muted text-foreground' : 'bg-destructive'}>{v}</Badge>;
}

const diffColor = (d: string) =>
  d === 'NO_CHANGE' ? 'bg-muted text-foreground' : d === 'CONFLICT' ? 'bg-destructive' : d === 'CREATE' ? 'bg-blue-600' : 'bg-amber-600';

export default function ProductHubComCanary() {
  const { roles } = useAuth();
  const canRun = (roles || []).some((r: string) => ['Super Admin', 'Admin'].includes(r));
  const [state, setState] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const call = async (action: string, body: Record<string, any> = {}, silent = false) => {
    if (!silent) setBusy(action);
    try {
      const { data, error } = await supabase.functions.invoke('product-hub-com-canary', { body: { action, ...body } });
      if (error) {
        let detail = '';
        try { detail = (await (error as any)?.context?.json())?.error || ''; } catch { /* ignore */ }
        throw new Error(detail || error.message || 'Aktion fehlgeschlagen');
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as any;
    } catch (e: any) {
      if (!silent) toast.error(e.message || 'Aktion fehlgeschlagen');
      return null;
    } finally { if (!silent) setBusy(null); }
  };

  const load = async () => { const s = await call('status', {}, true); if (s) setState(s); };
  useEffect(() => { (async () => { await load(); setLoading(false); })(); }, []);

  const batch = state?.batch;
  const snaps: any[] = state?.snapshots || [];
  const checks = batch?.checks || {};
  const writeBlocker = (state?.tests || []).find((t: any) => t.name === 'COM-Schreib-Endpunkt erreichbar' && !t.pass)?.detail;

  const dash = useMemo(() => ({
    com_write: state?.com_write ?? 'UNKNOWN',
    snapshot: batch?.status === 'FROZEN' ? 'FROZEN' : (batch?.status || 'NOT READY'),
    diffs: String((checks.changes ?? 0)),
    rollback: checks.rollback || 'NOT READY',
    dry_run: checks.dry_run || 'NOT READY',
    optimistic_lock: state?.com_write === 'READY' ? 'READY' : 'NOT READY',
    readback: snaps.some((s) => s.readback_at) ? 'READY' : (batch ? 'READY' : 'NOT READY'),
    audit: batch ? 'READY' : 'NOT READY',
    render: state?.render ?? 'UNKNOWN',
    publish: checks.publish || 'OFFEN',
    phase: state?.phase ?? 'B',
  }), [state, batch, checks, snaps]);

  const readyForCanary =
    dash.com_write === 'READY' && dash.snapshot === 'FROZEN' &&
    ['READY', 'NOT_REQUIRED'].includes(dash.rollback) && dash.dry_run === 'PASSED';

  if (loading) return <div className="p-8 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Lade COM Canary Panel…</div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="Product Hub · BlueIce COM Canary" subtitle="Alix BlueIce Smart KI · strikte COM-ID, keine Fuzzy-Zuordnung" icon={Globe} />

      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="text-sm">BLUEICE COM CANARY SAFETY</CardTitle>
          <Badge variant="outline">Phase {dash.phase}</Badge>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-xs">
          {[
            ['COM Write', dash.com_write], ['Snapshot', dash.snapshot], ['Diffs', dash.diffs],
            ['Rollback', dash.rollback], ['Dry Run', dash.dry_run], ['Optimistic Lock', dash.optimistic_lock],
            ['Read-back', dash.readback], ['Audit', dash.audit], ['Website Rendering', dash.render],
            ['Publish', dash.publish], ['COM Product ID', COM_BLUEICE_ID.slice(0, 8) + '…'], ['Phase', dash.phase],
          ].map(([k, v]) => (
            <div key={k as string} className="flex items-center justify-between gap-2 rounded border px-2 py-1.5">
              <span className="text-muted-foreground">{k}</span>
              {['Diffs', 'Phase', 'COM Product ID'].includes(k as string) ? <span className="font-medium">{v}</span> : <Dot v={String(v)} />}
            </div>
          ))}
          <div className="sm:col-span-2 lg:col-span-3 rounded border px-2 py-1.5">
            <span className="text-muted-foreground">Empfehlung: </span>
            <Badge className={readyForCanary ? 'bg-emerald-600' : 'bg-destructive'}>
              {readyForCanary ? 'READY FOR COM CANARY' : 'NOT READY'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {writeBlocker && (
        <div className="rounded border border-destructive bg-destructive/10 px-4 py-3 text-sm">
          <p className="font-semibold text-destructive">COM Live-Push blockiert</p>
          <p className="mt-1 text-muted-foreground">{writeBlocker}</p>
          <p className="mt-1 text-xs text-muted-foreground">Phase B bleibt aktiv. Snapshot, Dry Run und Veröffentlichung bleiben gesperrt.</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={!canRun || !!busy} onClick={async () => { const r = await call('com_dump'); if (r) { console.log('COM dump', r.mapping ?? r); toast[r.missing?.length ? 'error' : 'success'](r.summary || 'Diagnose ausgefuehrt'); } }}>
          {busy === 'com_dump' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanSearch className="h-3.5 w-3.5" />} 0 · COM-Export Diagnose
        </Button>
        <Button size="sm" disabled={!canRun || !!busy} onClick={async () => { const r = await call('selftest'); if (r) { await load(); toast[r.ready ? 'success' : 'error'](r.com_write); } }}>
          {busy === 'selftest' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />} 1 · Vertragstest
        </Button>
        <Button size="sm" variant="outline" disabled={!canRun || !!busy} onClick={async () => { const r = await call('field_probe'); if (r) { console.log('COM Feld-Probe', r.probe ?? r); toast[r.field_probe === 'COMPLETE' ? 'success' : 'error'](r.summary || r.detail || `Feld-Probe ${r.field_probe}`); } }}>
          {busy === 'field_probe' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanSearch className="h-3.5 w-3.5" />} 1b · COM-Feld-Probe
        </Button>


        <Button size="sm" disabled={!canRun || !!busy || state?.com_write !== 'READY'} onClick={async () => { const r = await call('snapshot'); if (r) { await load(); toast.success(`${r.snapshot} · ${r.changes} Änderungen`); } }}>
          {busy === 'snapshot' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Snowflake className="h-3.5 w-3.5" />} 2 · COM-Snapshot einfrieren
        </Button>
        <Button size="sm" disabled={!canRun || !!busy || !batch} onClick={async () => { const r = await call('dryrun', { batch_id: batch?.id }); if (r) { await load(); toast[r.dry_run === 'PASSED' ? 'success' : 'error'](`Dry Run ${r.dry_run}`); } }}>
          3 · Dry Run
        </Button>
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" disabled={!canRun || !!busy || !readyForCanary}
          onClick={async () => {
            if (!confirm('BlueIce COM Canary jetzt LIVE veröffentlichen?')) return;
            const r = await call('publish', { batch_id: batch?.id, confirm: 'COM CANARY GO' });
            if (r) { await load(); toast[r.publish === 'SUCCESS' ? 'success' : 'error'](`Publish ${r.publish}${r.stopped_at ? ': ' + r.stopped_at : ''}`); }
          }}>
          {busy === 'publish' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />} 4 · Live veröffentlichen
        </Button>
        <Button size="sm" variant="outline" disabled={!canRun || !!busy} onClick={async () => { const r = await call('render_check'); if (r) { await load(); toast(r.render); } }}>
          5 · Website-Rendering prüfen
        </Button>
        <Button size="sm" variant="destructive" disabled={!canRun || !!busy || !batch} onClick={async () => { if (!confirm('Rollback auf COM-Snapshot-Werte?')) return; const r = await call('rollback', { batch_id: batch?.id }); if (r) { await load(); toast.success('Rollback ausgeführt'); } }}>
          <Undo2 className="h-3.5 w-3.5" /> Rollback
        </Button>
      </div>

      {!!(state?.tests || []).length && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Vertragstest (nur Dry Run)</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Test</TableHead><TableHead>HTTP</TableHead><TableHead>Detail</TableHead><TableHead className="text-right">Ergebnis</TableHead></TableRow></TableHeader>
              <TableBody>
                {state.tests.map((t: any) => (
                  <TableRow key={t.name}>
                    <TableCell className="text-xs">{t.name}</TableCell>
                    <TableCell className="text-xs">{t.status}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[380px] truncate">{t.detail}</TableCell>
                    <TableCell className="text-right"><Badge className={t.pass ? 'bg-emerald-600' : 'bg-destructive'}>{t.pass ? 'OK' : 'FEHLER'}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">COM Live Snapshot ↔ AlixWork Master (11 Felder)</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Feld</TableHead><TableHead>COM Live (Legacy 1:1)</TableHead><TableHead>Master (Ziel)</TableHead><TableHead>Read-back</TableHead><TableHead className="text-right">Diff</TableHead></TableRow></TableHeader>
            <TableBody>
              {snaps.length === 0 && <TableRow><TableCell colSpan={5} className="text-xs text-muted-foreground py-6 text-center">Noch kein COM-Snapshot eingefroren.</TableCell></TableRow>}
              {snaps.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="text-xs font-medium">{s.field}</TableCell>
                  <TableCell className="text-xs">{s.current_live_value ?? <span className="text-muted-foreground">leer</span>}</TableCell>
                  <TableCell className="text-xs">{s.target_master_value ?? <span className="text-muted-foreground">leer</span>}</TableCell>
                  <TableCell className="text-xs">{s.readback_value ?? '—'}</TableCell>
                  <TableCell className="text-right"><Badge className={diffColor(s.value_state)}>{s.value_state}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {!!(checks.results || []).length && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Live-Push Protokoll</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Feld</TableHead><TableHead>Aktion</TableHead><TableHead>Read-back</TableHead><TableHead className="text-right">Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {(checks.results as any[]).map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs">{r.field}</TableCell>
                    <TableCell className="text-xs">{r.action}{r.reason ? ` (${r.reason})` : ''}</TableCell>
                    <TableCell className="text-xs">{r.readback ?? '—'}</TableCell>
                    <TableCell className="text-right text-xs">{r.error ? <Badge className="bg-destructive">{r.error}</Badge> : <Badge className="bg-emerald-600">{r.verified ? 'VERIFIED' : 'SKIP'}</Badge>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
