import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import {
  Play, RefreshCw, Clock, Mail, PlusCircle, PencilLine, CheckCircle2, XCircle, Send,
} from 'lucide-react';

type Diff = { field: string; old: unknown; new: unknown };
type ChangeEntry = {
  kind: 'new' | 'changed';
  source_system: string;
  invoice_number: string | null;
  customer_name: string | null;
  invoice_date: string | null;
  total: number | null;
  currency: string | null;
  diffs: Diff[];
};
type Run = {
  id: string;
  trigger_type: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  new_count: number;
  changed_count: number;
  unchanged_count: number;
  failed_count: number;
  processed_count: number;
  changes: ChangeEntry[] | null;
  email_sent: boolean;
  email_error: string | null;
  error_message: string | null;
};

const FIELD_LABELS: Record<string, string> = {
  invoice_number: 'Rechnungsnr.', reference_number: 'Referenz', customer_name: 'Kunde',
  city: 'Ort', invoice_date: 'Datum', due_date: 'Fällig', currency: 'Währung',
  total: 'Betrag', balance: 'Saldo', status: 'Status', payment_status: 'Zahlungsstatus',
  last_payment_date: 'Letzte Zahlung', accounting_region: 'Buchungskreis',
};
const SOURCE_LABELS: Record<string, string> = {
  zoho_eu_1: 'Alix Deutschland 🇩🇪',
  zoho_eu_2: 'Alix Austria 🇦🇹',
};

const fmtDt = (v: string | null) =>
  v ? new Date(v).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '–';
const fmtVal = (v: unknown) => (v == null || v === '' ? '–' : String(v));

export default function AutoImportTab() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [testing, setTesting] = useState(false);
  const [selected, setSelected] = useState<Run | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('zoho_auto_import_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(30);
    if (error) {
      toast({ title: 'Laden fehlgeschlagen', description: error.message, variant: 'destructive' });
    } else {
      const rows = (data ?? []) as unknown as Run[];
      setRuns(rows);
      setSelected((prev) => rows.find((r) => r.id === prev?.id) ?? rows[0] ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRuns(); }, [fetchRuns]);

  const startManual = async () => {
    setRunning(true);
    setProgress(8);
    const tick = setInterval(() => setProgress((p) => (p == null ? 8 : Math.min(92, p + 4))), 2500);
    try {
      const { data, error } = await supabase.functions.invoke('zoho-invoices-auto-import', {
        body: { trigger_type: 'manual' },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setProgress(100);
      toast({
        title: 'Auto-Import abgeschlossen',
        description: `Neu: ${data?.new_count ?? 0} • Veränderungen: ${data?.changed_count ?? 0} • E-Mail: ${data?.email_sent ? 'versendet' : 'fehlgeschlagen'}`,
      });
      await fetchRuns();
    } catch (e: any) {
      toast({ title: 'Auto-Import fehlgeschlagen', description: e?.message ?? 'Unbekannter Fehler', variant: 'destructive' });
    } finally {
      clearInterval(tick);
      setRunning(false);
      setTimeout(() => setProgress(null), 1500);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('zoho-invoices-auto-import', {
        body: { test_email: true },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'Testmail versendet', description: 'An rde@alix-lasers.com (CC k.trinh@alix-operation.de)' });
    } catch (e: any) {
      toast({ title: 'Testmail fehlgeschlagen', description: e?.message ?? 'Unbekannter Fehler', variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  const changes = selected?.changes ?? [];

  return (
    <div className="space-y-4">
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" /> Automatischer Rechnungsimport (Zoho → Buchhaltung/Rechnungen)
              </CardTitle>
              <CardDescription>
                Läuft täglich um <b>13:00</b> und <b>22:20</b> Uhr für Alix Deutschland &amp; Alix Austria.
                Bestehende Rechnungen werden <b>nicht überschrieben</b> – Abweichungen werden nur gemeldet
                und per E-Mail an <b>rde@alix-lasers.com</b> (CC k.trinh@alix-operation.de) versendet.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={sendTest} disabled={testing}>
                <Send className={`w-4 h-4 mr-2 ${testing ? 'animate-pulse' : ''}`} /> Testmail senden
              </Button>
              <Button variant="outline" size="sm" onClick={fetchRuns} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Aktualisieren
              </Button>
              <Button size="sm" onClick={startManual} disabled={running} className="gold-gradient text-primary-foreground">
                <Play className={`w-4 h-4 mr-2 ${running ? 'animate-pulse' : ''}`} />
                {running ? 'Import läuft…' : 'Jetzt manuell starten'}
              </Button>
            </div>
          </div>
        </CardHeader>
        {progress != null && (
          <CardContent className="pt-0">
            <div className="flex items-center justify-between text-sm mb-2">
              <span>Import läuft – Rechnungen werden geprüft…</span>
              <span className="tabular-nums text-muted-foreground">{progress}%</span>
            </div>
            <Progress value={progress} />
          </CardContent>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Läufe */}
        <Card className="border-border lg:col-span-1">
          <CardHeader className="pb-3"><CardTitle className="text-base">Letzte Läufe</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <>
                <Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" />
              </>
            ) : runs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Noch keine Läufe vorhanden.</p>
            ) : (
              <ScrollArea className="h-[420px] pr-2">
                <div className="space-y-2">
                  {runs.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setSelected(r)}
                      className={`w-full text-left rounded-lg border p-3 transition-colors ${
                        selected?.id === r.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/30'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{fmtDt(r.started_at)}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {r.trigger_type === 'manual' ? 'manuell' : 'automatisch'}
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="text-emerald-500">{r.new_count} neu</span>
                        <span className="text-amber-500">{r.changed_count} geändert</span>
                        <span>{r.unchanged_count} unverändert</span>
                        {r.status === 'failed' && <Badge variant="destructive" className="text-[10px]">Fehler</Badge>}
                        {r.email_sent
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          : <XCircle className="w-3.5 h-3.5 text-destructive" />}
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Veränderungen */}
        <Card className="border-border lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              Veränderungen {selected && <span className="text-muted-foreground font-normal text-sm">· {fmtDt(selected.started_at)}</span>}
            </CardTitle>
            {selected && (
              <CardDescription className="flex flex-wrap items-center gap-3">
                <span className="text-emerald-500">{selected.new_count} neu importiert</span>
                <span className="text-amber-500">{selected.changed_count} Abweichungen (nicht überschrieben)</span>
                <span>{selected.unchanged_count} unverändert</span>
                <span>{selected.failed_count} Fehler</span>
                <span>{selected.processed_count} geprüft</span>
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" />
                  {selected.email_sent ? 'E-Mail versendet' : `E-Mail fehlgeschlagen${selected.email_error ? `: ${selected.email_error}` : ''}`}
                </span>
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {!selected ? (
              <p className="text-sm text-muted-foreground py-10 text-center">Keinen Lauf ausgewählt.</p>
            ) : changes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">Keine Veränderungen in diesem Lauf.</p>
            ) : (
              <ScrollArea className="h-[420px] pr-2">
                <div className="divide-y divide-border">
                  {changes.map((c, i) => (
                    <div key={`${c.invoice_number ?? 'x'}-${i}`} className="py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {c.kind === 'new' ? (
                          <Badge variant="outline" className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30">
                            <PlusCircle className="w-3 h-3 mr-1" /> Neu
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-500/15 text-amber-500 border-amber-500/30">
                            <PencilLine className="w-3 h-3 mr-1" /> Änderung
                          </Badge>
                        )}
                        <span className="font-medium">{fmtVal(c.invoice_number)}</span>
                        <span className="text-muted-foreground">{fmtVal(c.customer_name)}</span>
                        <span className="text-xs text-muted-foreground">{fmtVal(c.invoice_date)}</span>
                        <span className="text-xs text-muted-foreground">{SOURCE_LABELS[c.source_system] ?? c.source_system}</span>
                        <span className="ml-auto tabular-nums">{fmtVal(c.total)} {fmtVal(c.currency)}</span>
                      </div>
                      {c.diffs?.length > 0 && (
                        <ul className="mt-2 space-y-1 text-xs">
                          {c.diffs.map((d) => (
                            <li key={d.field} className="flex flex-wrap items-center gap-2">
                              <span className="text-muted-foreground min-w-[130px]">{FIELD_LABELS[d.field] ?? d.field}</span>
                              <span className="line-through text-muted-foreground">{fmtVal(d.old)}</span>
                              <span>→</span>
                              <span className="font-medium">{fmtVal(d.new)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
