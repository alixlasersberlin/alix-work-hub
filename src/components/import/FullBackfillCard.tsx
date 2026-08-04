import { useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { History, Loader2, Play, Square } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Totals = { imported: number; updated: number; failed: number };
type StepKey = 'profiles' | 'recurring_invoices' | 'invoices' | 'credit_notes' | 'orders' | 'packages';

const STEP_LABELS: Record<StepKey, string> = {
  profiles: 'Periodische Rechnungs-Stammdaten (alle Status, inkl. beendet)',
  recurring_invoices: 'Periodische Rechnungen (erzeugte Raten)',
  invoices: 'Rechnungen (alle Status)',
  credit_notes: 'Gutschriften',
  orders: 'Aufträge (alle Status, inkl. geschlossen & offener Versand)',
  packages: 'Versand / Pakete',
};

const SOURCES: { key: 'zoho_eu_1' | 'zoho_eu_2'; label: string }[] = [
  { key: 'zoho_eu_1', label: '🇩🇪 Alix Deutschland' },
  { key: 'zoho_eu_2', label: '🇦🇹 Alix Austria' },
];

const emptyTotals = (): Totals => ({ imported: 0, updated: 0, failed: 0 });

export default function FullBackfillCard() {
  const [dateFrom, setDateFrom] = useState('2010-01-01');
  const [sources, setSources] = useState<Record<string, boolean>>({ zoho_eu_1: true, zoho_eu_2: true });
  const [running, setRunning] = useState(false);
  const [currentLabel, setCurrentLabel] = useState('');
  const [pct, setPct] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [totals, setTotals] = useState<Record<string, Totals>>({});
  const cancelRef = useRef(false);

  const addLog = (line: string) => setLog((l) => [...l.slice(-80), line]);

  const bump = (key: string, r: any) => {
    setTotals((t) => {
      const prev = t[key] ?? emptyTotals();
      return {
        ...t,
        [key]: {
          imported: prev.imported + (Number(r?.imported) || 0),
          updated: prev.updated + (Number(r?.updated) || 0),
          failed: prev.failed + (Number(r?.failed) || 0),
        },
      };
    });
  };

  async function callFn(name: string, body: Record<string, unknown>) {
    const { data, error } = await supabase.functions.invoke(name, { body });
    if (error) throw new Error(error.message);
    if ((data as any)?.error) throw new Error(String((data as any).error));
    return data as any;
  }

  async function runPaged(
    key: string,
    fn: string,
    baseBody: Record<string, unknown>,
    nextPage: (r: any, cur: number) => number,
    more: (r: any) => boolean,
    maxIterations = 120,
  ) {
    let page = 1;
    for (let i = 0; i < maxIterations; i++) {
      if (cancelRef.current) return;
      const r = await callFn(fn, { ...baseBody, page });
      bump(key, r);
      addLog(`${key} · Seite ${page}: +${r?.imported ?? 0} neu / ${r?.updated ?? 0} akt. / ${r?.failed ?? 0} Fehler`);
      if (!more(r)) return;
      page = nextPage(r, page);
    }
    addLog(`${key}: Iterationslimit erreicht — bitte erneut starten, um fortzusetzen.`);
  }

  async function start() {
    cancelRef.current = false;
    setRunning(true);
    setLog([]);
    setTotals({});
    setPct(0);
    const active = SOURCES.filter((s) => sources[s.key]);
    const steps: StepKey[] = ['profiles', 'recurring_invoices', 'invoices', 'credit_notes', 'orders', 'packages'];
    const totalSteps = active.length * steps.length;
    let done = 0;

    try {
      for (const src of active) {
        for (const step of steps) {
          if (cancelRef.current) break;
          const key = `${src.key}:${step}`;
          setCurrentLabel(`${src.label} — ${STEP_LABELS[step]}`);
          try {
            if (step === 'profiles') {
              await runPaged(key, 'sync-zoho-recurring-profiles',
                { source_system: src.key, per_page: 200, max_pages: 5, region_filter: 'all' },
                (r, cur) => (Number(r?.last_page) || cur) + 1, (r) => r?.has_more === true);
            } else if (step === 'recurring_invoices') {
              await runPaged(key, 'sync-zoho-recurring-invoices',
                { source_system: src.key, date_from: dateFrom, per_page: 50, max_pages: 1 },
                (r, cur) => (Number(r?.last_profile_page) || cur) + 1, (r) => r?.profiles_have_more === true);
            } else if (step === 'invoices') {
              await runPaged(key, 'sync-zoho-invoices',
                { source_system: src.key, date_from: dateFrom, per_page: 200, max_pages: 3, region_filter: 'all' },
                (r, cur) => (Number(r?.last_page) || cur) + 1, (r) => r?.has_more === true);
            } else if (step === 'credit_notes') {
              await runPaged(key, 'sync-zoho-credit-notes',
                { source_system: src.key, date_from: dateFrom, per_page: 200, max_pages: 3 },
                (r, cur) => (Number(r?.last_page) || cur) + 1, (r) => r?.has_more === true);
            } else if (step === 'orders') {
              await runPaged(key, 'scheduled-order-sync',
                { source_system: src.key, since: dateFrom, max_pages: 3, auto_sync_customers: true },
                (r, cur) => (Number(r?.next_page) || cur + 1), (r) => r?.has_more === true);
            } else {
              const r = await callFn('sync-zoho-packages', { source_system: src.key, per_page: 200, max_pages: 200 });
              addLog(`${key}: ${r?.packages_fetched ?? 0} Pakete, ${r?.orders_updated ?? 0} Aufträge aktualisiert`);
            }
          } catch (e: any) {
            addLog(`⚠️ ${key}: ${e.message}`);
          }
          done++;
          setPct(Math.round((done / totalSteps) * 100));
        }
      }
      if (cancelRef.current) toast.info('Backfill abgebrochen');
      else { setPct(100); toast.success('Voll-Backfill abgeschlossen'); }
    } finally {
      setRunning(false);
      setCurrentLabel('');
    }
  }

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          Voll-Backfill aus Zoho (seit Beginn, alle Status)
        </CardTitle>
        <CardDescription>
          Importiert periodische Rechnungs-Stammdaten (auch beendete/gestoppte), periodische Rechnungen, alle Rechnungen
          und Gutschriften, alle Aufträge inkl. geschlossener sowie sämtliche Versand-/Paketstatus – für beide Mandanten.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Startdatum</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} disabled={running} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Mandanten</Label>
            <div className="flex items-center gap-6 pt-2">
              {SOURCES.map((s) => (
                <label key={s.key} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={!!sources[s.key]}
                    disabled={running}
                    onCheckedChange={(v) => setSources((p) => ({ ...p, [s.key]: !!v }))}
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={start} disabled={running || !Object.values(sources).some(Boolean)}>
            {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
            {running ? 'Backfill läuft…' : 'Voll-Backfill starten'}
          </Button>
          {running && (
            <Button variant="outline" onClick={() => { cancelRef.current = true; }}>
              <Square className="w-4 h-4 mr-2" /> Abbrechen
            </Button>
          )}
        </div>

        {(running || pct > 0) && (
          <div className="space-y-2">
            <Progress value={pct} />
            <p className="text-xs text-muted-foreground">{currentLabel || 'Fertig'} · {pct}%</p>
          </div>
        )}

        {Object.keys(totals).length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(totals).map(([k, t]) => (
              <div key={k} className="flex items-center justify-between rounded-md border border-border p-2 text-xs">
                <span className="truncate">{k}</span>
                <span className="flex gap-1">
                  <Badge variant="secondary">{t.imported} neu</Badge>
                  <Badge variant="outline">{t.updated} akt.</Badge>
                  {t.failed > 0 && <Badge variant="destructive">{t.failed} Fehler</Badge>}
                </span>
              </div>
            ))}
          </div>
        )}

        {log.length > 0 && (
          <div className="max-h-56 overflow-y-auto rounded-md bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
            {log.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
