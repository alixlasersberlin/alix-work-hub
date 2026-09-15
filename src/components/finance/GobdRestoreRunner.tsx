/**
 * GoBD Phase 15B – schonende Batch-Verarbeitung des Wiederherstellungstests.
 * Zeigt Fortschritt, Checkpoint, Fehler und Laufzeit und erlaubt
 * PAUSIEREN, FORTSETZEN und SICHER ABBRECHEN.
 */
import { useEffect, useRef, useState } from 'react';
import { Play, Pause, StopCircle, RotateCcw, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

type Progress = {
  phase: string; control: string; file: string; rows_done: number; rows_total: number;
  batches: number; verify: string | null; last_checkpoint_at: string | null;
  retries: number; next_retry_at: string | null; last_error: string | null;
};
type Status = 'BEREIT' | 'LÄUFT' | 'PAUSIERT' | 'FEHLER' | 'ABGESCHLOSSEN';

export function GobdRestoreRunner({ onFinished }: { onFinished?: () => void }) {
  const [runId, setRunId] = useState<string>(() => localStorage.getItem('gobd_restore_run') ?? '');
  const [status, setStatus] = useState<Status>('BEREIT');
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const loop = useRef(false);

  useEffect(() => {
    const t = window.setInterval(() => setTick((v) => v + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  async function call(action: string, extra: Record<string, unknown> = {}) {
    const { data, error: fnErr } = await supabase.functions.invoke('gobd-restore-test', {
      body: { action, run_id: runId || undefined, ...extra },
    });
    if (fnErr) throw new Error(fnErr.message);
    return data as any;
  }

  async function step(action: string) {
    const res = await call(action);
    if (res?.run_id && res.run_id !== runId) {
      setRunId(res.run_id);
      localStorage.setItem('gobd_restore_run', res.run_id);
    }
    if (res?.progress) setProgress(res.progress);
    if (res?.error) setError(res.error); else if (!res?.backoff) setError(null);
    if (res?.reason === 'db_unhealthy') {
      setStatus('PAUSIERT');
      toast.warning('Datenbank derzeit nicht ausreichend erreichbar – Start verschoben.');
      return 'stop';
    }
    if (res?.done) { setStatus('ABGESCHLOSSEN'); onFinished?.(); return 'stop'; }
    if (res?.paused) { setStatus('PAUSIERT'); return 'stop'; }
    if (res?.backoff || res?.waiting) { setStatus('LÄUFT'); return 'wait'; }
    return 'continue';
  }

  async function run(first: 'start' | 'resume' | 'continue') {
    if (loop.current) return;
    loop.current = true;
    setBusy(true);
    setStatus('LÄUFT');
    if (!startedAt) setStartedAt(Date.now());
    let action = first;
    try {
      for (;;) {
        const r = await step(action);
        if (r === 'stop') break;
        if (r === 'wait') await new Promise((res) => setTimeout(res, 5000));
        else await new Promise((res) => setTimeout(res, 500));
        if (!loop.current) break;
        action = 'continue';
      }
    } catch (e) {
      setStatus('FEHLER');
      setError(e instanceof Error ? e.message : String(e));
      toast.error('Verarbeitung gestoppt – siehe Fehlermeldung.');
    } finally {
      loop.current = false;
      setBusy(false);
    }
  }

  async function pause() {
    loop.current = false;
    try { await call('pause'); setStatus('PAUSIERT'); toast.info('Verarbeitung pausiert – Checkpoint gespeichert.'); }
    catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  }

  async function abort() {
    loop.current = false;
    try {
      await call('abort');
      setStatus('BEREIT'); setProgress(null); setRunId('');
      localStorage.removeItem('gobd_restore_run');
      toast.success('Lauf sicher abgebrochen, Testumgebung entfernt.');
      onFinished?.();
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  }

  const pct = progress && progress.rows_total
    ? Math.min(100, Math.round((progress.rows_done / progress.rows_total) * 100))
    : 0;
  const runtime = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Wiederherstellungstest · schonende Batch-Verarbeitung</CardTitle>
        <Badge variant={status === 'FEHLER' ? 'destructive' : status === 'ABGESCHLOSSEN' ? 'outline' : 'secondary'}>
          {status}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void run('start')} disabled={busy || !!runId}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />} Starten
          </Button>
          <Button variant="outline" onClick={() => void run('resume')} disabled={busy || !runId}>
            <RotateCcw className="mr-2 h-4 w-4" /> Fortsetzen
          </Button>
          <Button variant="outline" onClick={() => void pause()} disabled={!runId || status !== 'LÄUFT'}>
            <Pause className="mr-2 h-4 w-4" /> Pausieren
          </Button>
          <Button variant="destructive" onClick={() => void abort()} disabled={!runId}>
            <StopCircle className="mr-2 h-4 w-4" /> Sicher abbrechen
          </Button>
        </div>

        <Progress value={pct} />

        <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><span className="text-muted-foreground">Verarbeitet: </span>
            {(progress?.rows_done ?? 0).toLocaleString('de-DE')} / {(progress?.rows_total ?? 0).toLocaleString('de-DE')}</div>
          <div><span className="text-muted-foreground">Pakete (250): </span>{progress?.batches ?? 0}</div>
          <div><span className="text-muted-foreground">Phase: </span>
            {progress?.phase === 'verify' ? `Vergleich ${progress?.verify ?? ''}` : `Laden ${progress?.file ?? '—'}`}</div>
          <div><span className="text-muted-foreground">Laufzeit: </span>{runtime > 0 ? `${runtime} s` : '—'}</div>
          <div className="lg:col-span-2"><span className="text-muted-foreground">Letzter Checkpoint: </span>
            {progress?.last_checkpoint_at ? new Date(progress.last_checkpoint_at).toLocaleString('de-DE') : '—'}</div>
          <div><span className="text-muted-foreground">Wiederholungen: </span>{progress?.retries ?? 0}</div>
          <div className="truncate text-xs text-muted-foreground">Lauf: {runId || '—'}{tick ? '' : ''}</div>
        </div>

        {(error || progress?.last_error) && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            {error ?? progress?.last_error}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          Es werden höchstens 250 Datensätze je Paket verarbeitet, nach jedem Paket wird ein Checkpoint gespeichert
          und zwischen den Paketen pausiert. Bei Zeitüberschreitungen oder hoher Last wartet die Verarbeitung
          zunehmend länger statt sofort zu wiederholen. Produktive Daten werden nicht verändert.
        </p>
      </CardContent>
    </Card>
  );
}
