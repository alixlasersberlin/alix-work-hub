import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  CalendarSync, FileSearch, Play, Undo2, FileDown, Loader2, ScanText, Sparkles, AlertTriangle, Search, X, Receipt,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type Item = {
  id: string;
  profile_id: string | null;
  order_number: string | null;
  customer_name: string | null;
  document_id: string | null;
  document_title: string | null;
  document_type: string | null;
  delivery_date: string | null;
  delivery_source: string | null;
  estimated: boolean;
  first_rate_old: string | null;
  first_rate_new: string | null;
  shifted_count: number;
  status: string;
  needs_review: boolean;
  reason: string | null;
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  bereit: 'default',
  übernommen: 'default',
  unverändert: 'secondary',
  nacharbeit: 'destructive',
  fehler: 'destructive',
};

const de = (d?: string | null) => (d ? new Date(d).toLocaleDateString('de-DE') : '—');

type ProfileHit = {
  id: string;
  reference_number: string | null;
  customer_name: string | null;
  company_name: string | null;
  recurrence_name: string | null;
  status: string | null;
  accounting_region: string | null;
  start_date: string | null;
};

export default function RatenplanSync() {
  const [region, setRegion] = useState<'EU' | 'CH'>('EU');
  const [statuses, setStatuses] = useState<string[]>(['stopped', 'expired']);
  const [limit, setLimit] = useState(100);
  const [useAi, setUseAi] = useState(true);

  // Einzelkunden-Modus
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState<ProfileHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [target, setTarget] = useState<ProfileHit | null>(null);

  const [scanning, setScanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [backupId, setBackupId] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState(0);

  // Monatliche Rechnungserzeugung ab Lieferdatum
  const [invBusy, setInvBusy] = useState<'preview' | 'generate' | null>(null);
  const [invStats, setInvStats] = useState<any>(null);
  const [invItems, setInvItems] = useState<any[]>([]);
  const [horizon, setHorizon] = useState(0);

  const call = async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('ratenplan-sync', { body: payload });
    if (error) {
      const details = (error as any)?.context ? await (error as any).context.text() : error.message;
      throw new Error(details || error.message);
    }
    if ((data as any)?.error) throw new Error((data as any).error);
    return data as any;
  };

  const runInvoices = async (action: 'preview' | 'generate') => {
    setInvBusy(action);
    try {
      const payload: Record<string, unknown> = { action, region, horizon_months: horizon };
      if (target) payload.profile_ids = [target.id];
      const { data, error } = await supabase.functions.invoke('ratenplan-invoices', { body: payload });
      if (error) {
        const details = (error as any)?.context ? await (error as any).context.text() : error.message;
        throw new Error(details || error.message);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      setInvStats((data as any).stats);
      setInvItems((data as any).items ?? []);
      toast.success(
        action === 'preview'
          ? `Vorschau: ${(data as any).stats.planned} Raten offen, ${(data as any).stats.existing} bereits vorhanden`
          : `${(data as any).stats.created} Ratenrechnungen erzeugt`,
      );
    } catch (e: any) {
      toast.error(e.message ?? 'Fehler bei der Rechnungserzeugung');
    } finally {
      setInvBusy(null);
    }
  };


  const searchProfiles = async () => {
    const q = term.trim();
    if (q.length < 2) { toast.error('Mindestens 2 Zeichen eingeben'); return; }
    setSearching(true);
    try {
      const esc = q.replace(/[%,()]/g, ' ').trim();
      const { data, error } = await supabase
        .from('zoho_recurring_profiles')
        .select('id, reference_number, customer_name, company_name, recurrence_name, status, accounting_region, start_date')
        .or([
          `reference_number.ilike.%${esc}%`,
          `customer_name.ilike.%${esc}%`,
          `company_name.ilike.%${esc}%`,
          `recurrence_name.ilike.%${esc}%`,
        ].join(','))
        .order('start_date', { ascending: false })
        .limit(25);
      if (error) throw error;
      const rows = (data as any as ProfileHit[]) ?? [];
      setHits(rows);
      if (!rows.length) toast.info('Kein Ratenplan gefunden');
    } catch (e: any) {
      toast.error(e.message ?? 'Suche fehlgeschlagen');
    } finally {
      setSearching(false);
    }
  };

  const loadItems = async (id: string) => {
    const { data, error } = await supabase
      .from('ratenplan_sync_items')
      .select('*')
      .eq('run_id', id)
      .order('status', { ascending: true })
      .limit(1000);
    if (error) { toast.error(error.message); return; }
    const rows = (data as any as Item[]) ?? [];
    setItems(rows);
    setSelected(new Set(rows.filter((r) => r.status === 'bereit').map((r) => r.id)));
  };

  const runScan = async (opts?: { profile?: ProfileHit | null; statusesOverride?: string[]; limitOverride?: number }) => {
    const profile = opts?.profile ?? target;
    setScanning(true); setProgress(8); setItems([]); setStats(null); setRunId(null); setBackupId(null);
    const tick = setInterval(() => setProgress((p) => Math.min(p + 3, 92)), 900);
    try {
      const payload: Record<string, unknown> = {
        action: 'scan',
        region,
        statuses: opts?.statusesOverride ?? statuses,
        limit: opts?.limitOverride ?? limit,
        useAi,
      };
      if (profile) payload.profile_ids = [profile.id];
      const res = await call(payload);
      setRunId(res.run_id); setStats(res.stats);
      await loadItems(res.run_id);
      setProgress(100);
      toast.success(
        `${profile ? 'Einzelprüfung' : 'Dry Run'} abgeschlossen: ${res.stats.ready} bereit, ${res.stats.needs_review} Nacharbeit`,
      );
    } catch (e: any) {
      toast.error(e.message ?? 'Scan fehlgeschlagen');
    } finally {
      clearInterval(tick); setScanning(false);
    }
  };


  const runApply = async () => {
    if (!runId || selected.size === 0) return;
    if (!confirm(`${selected.size} Ratenpläne wirklich synchronisieren? Ein Backup wird automatisch erzeugt.`)) return;
    setApplying(true);
    try {
      const res = await call({ action: 'apply', run_id: runId, item_ids: [...selected] });
      setBackupId(res.backup_id);
      toast.success(`${res.stats.updated} Ratenpläne synchronisiert (Backup ${res.backup_id.slice(0, 8)})`);
      if (res.stats.failed) toast.warning(`${res.stats.failed} übersprungen`);
      await loadItems(runId);
    } catch (e: any) {
      toast.error(e.message ?? 'Synchronisierung fehlgeschlagen');
    } finally {
      setApplying(false);
    }
  };

  const runRollback = async () => {
    if (!backupId) return;
    if (!confirm('Alle Änderungen dieses Laufs vollständig zurücksetzen?')) return;
    try {
      const res = await call({ action: 'rollback', backup_id: backupId });
      toast.success(`${res.restored} Datensätze wiederhergestellt`);
      setBackupId(null);
      if (runId) await loadItems(runId);
    } catch (e: any) {
      toast.error(e.message ?? 'Rollback fehlgeschlagen');
    }
  };

  const correctDate = async (item: Item) => {
    const input = prompt(`Korrektes Lieferdatum für ${item.order_number ?? item.customer_name} (TT.MM.JJJJ)`, de(item.delivery_date));
    if (!input) return;
    const m = input.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (!m) { toast.error('Format TT.MM.JJJJ erwartet'); return; }
    const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    try {
      await call({ action: 'correct', item_id: item.id, corrected_date: iso });
      toast.success('Korrektur gespeichert – die KI berücksichtigt sie künftig');
      if (runId) await loadItems(runId);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const rows = () => items.map((i) => [
    i.order_number ?? '', i.customer_name ?? '', i.document_title ?? '', i.document_type ?? '',
    de(i.delivery_date) + (i.estimated ? ' (geschätzt)' : ''), i.delivery_source ?? '',
    de(i.first_rate_old), de(i.first_rate_new), String(i.shifted_count), i.status, i.reason ?? '',
  ]);
  const HEAD = ['Auftrag', 'Kunde', 'Dokument', 'Typ', 'Lieferdatum', 'Quelle', 'Rate alt', 'Rate neu', 'Raten', 'Status', 'Hinweis'];

  const exportCsv = () => {
    const csv = [HEAD, ...rows()]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    downloadBlob(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }), 'ratenplan-sync.csv');
  };
  const exportJson = () =>
    downloadBlob(new Blob([JSON.stringify({ run_id: runId, stats, items }, null, 2)], { type: 'application/json' }), 'ratenplan-sync.json');
  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
    doc.setFontSize(14);
    doc.text('Ratenplan-Synchronisierung – Änderungsprotokoll', 14, 14);
    doc.setFontSize(9);
    doc.text(`Lauf: ${runId ?? '—'} · ${new Date().toLocaleString('de-DE')}`, 14, 20);
    autoTable(doc, { head: [HEAD], body: rows(), startY: 25, styles: { fontSize: 7 } });
    doc.save('ratenplan-sync.pdf');
  };
  const downloadBlob = (b: Blob, name: string) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = name; a.click();
  };

  const toggle = (id: string) =>
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const readyCount = items.filter((i) => i.status === 'bereit').length;
  const reviewItems = items.filter((i) => i.needs_review);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-display gold-text flex items-center gap-2">
          <CalendarSync className="w-6 h-6" /> Ratenplan synchronisieren
        </h1>
        <p className="text-sm text-muted-foreground">
          Liefertermine werden ausschließlich aus ALIXDOCS ermittelt (OCR + KI). Erste Rate = 1. des Folgemonats.
          Bezahlte Rechnungen, Raten und Buchungen bleiben unangetastet.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2">
          <Search className="w-4 h-4" /> Einzelnen Kunden / Ratenplan suchen
        </CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input
              className="max-w-md"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') searchProfiles(); }}
              placeholder="Kundenauftrag, Referenznummer, Kunde oder Ratenplanname…"
            />
            <Button variant="outline" onClick={searchProfiles} disabled={searching}>
              {searching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
              Suchen
            </Button>
            {target && (
              <Button variant="ghost" onClick={() => { setTarget(null); setHits([]); setTerm(''); }}>
                <X className="w-4 h-4 mr-2" /> Einzelmodus beenden
              </Button>
            )}
          </div>

          {target ? (
            <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-sm flex flex-wrap items-center gap-3">
              <Badge variant="default">Einzelmodus</Badge>
              <span className="font-mono text-xs">{target.reference_number ?? '—'}</span>
              <span className="font-medium">{target.company_name || target.customer_name}</span>
              <span className="text-xs text-muted-foreground">
                {target.recurrence_name ?? ''} · {target.status} · {target.accounting_region} · Start {de(target.start_date)}
              </span>
              <Button size="sm" onClick={() => runScan({ profile: target })} disabled={scanning}>
                {scanning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSearch className="w-4 h-4 mr-2" />}
                Nur diesen Kunden prüfen
              </Button>
            </div>
          ) : hits.length > 0 && (
            <div className="max-h-64 overflow-auto rounded-md border divide-y">
              {hits.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                  onClick={() => { setTarget(h); setHits([]); }}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs w-32 shrink-0">{h.reference_number ?? '—'}</span>
                    <span className="flex-1 truncate font-medium">{h.company_name || h.customer_name}</span>
                    <Badge variant="outline">{h.status}</Badge>
                    <Badge variant="secondary">{h.accounting_region}</Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {h.recurrence_name ?? ''} · Start {de(h.start_date)}
                  </div>
                </button>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Im Einzelmodus laufen alle Schritte (Dry Run, Synchronisieren, Rollback, Datumskorrektur) ausschließlich für den gewählten Ratenplan.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Auswahl & Aktionen</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Region</label>
              <select className="h-9 rounded-md border bg-background px-2 text-sm" disabled={!!target}
                value={region} onChange={(e) => setRegion(e.target.value as 'EU' | 'CH')}>
                <option value="EU">Buchhaltung EU</option>
                <option value="CH">Buchhaltung CH</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Status</label>
              <select className="h-9 rounded-md border bg-background px-2 text-sm" disabled={!!target}
                value={statuses.join(',')} onChange={(e) => setStatuses(e.target.value.split(','))}>
                <option value="stopped,expired">Beendet (gestoppt + abgelaufen)</option>
                <option value="stopped">Nur gestoppt</option>
                <option value="expired">Nur abgelaufen</option>
                <option value="active">Aktiv</option>
                <option value="active,stopped,expired,pruefung">Alle Verträge (Massenlauf)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Batchgröße</label>
              <select className="h-9 rounded-md border bg-background px-2 text-sm" disabled={!!target}
                value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
                {[20, 50, 100, 200, 300].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm h-9">
              <Checkbox checked={useAi} onCheckedChange={(v) => setUseAi(!!v)} />
              <Sparkles className="w-3.5 h-3.5" /> KI-Analyse
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => runScan()} disabled={scanning}>
              {scanning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSearch className="w-4 h-4 mr-2" />}
              {target ? 'Dry Run (nur gewählter Kunde)' : 'Dokumente durchsuchen · OCR · Dry Run'}
            </Button>

            <Button
              variant="secondary"
              disabled={scanning || !!target}
              onClick={() => {
                setStatuses(['active', 'stopped', 'expired', 'pruefung']);
                setLimit(300);
                runScan({ profile: null, statusesOverride: ['active', 'stopped', 'expired', 'pruefung'], limitOverride: 300 });
              }}
            >
              {scanning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSearch className="w-4 h-4 mr-2" />}
              Massenlauf: alle Verträge (300er-Batch)
            </Button>


            <Button variant="default" onClick={runApply} disabled={!runId || applying || selected.size === 0}>
              {applying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              Synchronisieren ({selected.size})
            </Button>
            <Button variant="outline" onClick={runRollback} disabled={!backupId}>
              <Undo2 className="w-4 h-4 mr-2" /> Rollback
            </Button>
            <Button variant="outline" onClick={exportPdf} disabled={!items.length}><FileDown className="w-4 h-4 mr-2" />PDF</Button>
            <Button variant="outline" onClick={exportCsv} disabled={!items.length}><FileDown className="w-4 h-4 mr-2" />CSV</Button>
            <Button variant="outline" onClick={exportJson} disabled={!items.length}><FileDown className="w-4 h-4 mr-2" />JSON</Button>
          </div>

          {scanning && <Progress value={progress} className="h-2" />}
        </CardContent>
      </Card>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            ['Geprüft', stats.checked],
            ['Dokumente gefunden', stats.documents_found],
            ['Bereit', stats.ready],
            ['Unverändert', stats.unchanged],
            ['Nacharbeit', stats.needs_review],
          ].map(([l, v]) => (
            <Card key={l as string}><CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{l as string}</div>
              <div className="text-2xl font-display gold-text">{v as number}</div>
            </CardContent></Card>
          ))}
        </div>
      )}

      {reviewItems.length > 0 && (
        <Card className="border-destructive/40">
          <CardHeader><CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" /> Prüfliste „NACHARBEIT" ({reviewItems.length})
          </CardTitle></CardHeader>
          <CardContent className="space-y-1 max-h-64 overflow-auto text-sm">
            {reviewItems.map((i) => (
              <div key={i.id} className="flex items-center gap-2 py-1 border-b border-border/40">
                <span className="font-mono text-xs w-32 shrink-0">{i.order_number ?? '—'}</span>
                <span className="flex-1 truncate">{i.customer_name}</span>
                <span className="text-xs text-muted-foreground truncate max-w-[40%]">{i.reason}</span>
                <Button size="sm" variant="ghost" onClick={() => correctDate(i)}>
                  <ScanText className="w-3.5 h-3.5 mr-1" /> Datum setzen
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {items.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">
            Vorschau ({items.length}) · {readyCount} übernehmbar
          </CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Auftrag</TableHead>
                  <TableHead>Kunde</TableHead>
                  <TableHead>Dokument</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Lieferdatum</TableHead>
                  <TableHead>Quelle</TableHead>
                  <TableHead>Rate alt</TableHead>
                  <TableHead>Rate neu</TableHead>
                  <TableHead>Raten</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>
                      <Checkbox
                        disabled={i.status !== 'bereit'}
                        checked={selected.has(i.id)}
                        onCheckedChange={() => toggle(i.id)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{i.order_number ?? '—'}</TableCell>
                    <TableCell className="text-xs max-w-[180px] truncate">{i.customer_name}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{i.document_title ?? '—'}</TableCell>
                    <TableCell className="text-xs">{i.document_type ?? '—'}</TableCell>
                    <TableCell className="text-xs">
                      {de(i.delivery_date)}{i.estimated && <Badge variant="outline" className="ml-1">geschätzt</Badge>}
                    </TableCell>
                    <TableCell className="text-xs">{i.delivery_source ?? '—'}</TableCell>
                    <TableCell className="text-xs">{de(i.first_rate_old)}</TableCell>
                    <TableCell className="text-xs font-medium">{de(i.first_rate_new)}</TableCell>
                    <TableCell className="text-xs">{i.shifted_count}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[i.status] ?? 'outline'}>{i.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2">
          <Receipt className="w-4 h-4" /> Monatliche Rechnungen ab Lieferdatum
        </CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Erzeugt für alle Verträge mit hinterlegtem Lieferdatum die Monatsraten – erste Rate = 1. des
            Folgemonats nach Lieferung, rückwirkend bis heute. Bereits erzeugte Raten werden nie doppelt angelegt.
            {target && <> Aktuell nur für <strong>{target.reference_number ?? target.recurrence_name}</strong>.</>}
          </p>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Künftige Raten im Voraus</label>
              <select className="h-9 rounded-md border bg-background px-2 text-sm"
                value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}>
                {[0, 3, 6, 12, 24].map((n) => (
                  <option key={n} value={n}>{n === 0 ? 'nur bis heute' : `+ ${n} Monate`}</option>
                ))}
              </select>
            </div>
            <Button variant="outline" onClick={() => runInvoices('preview')} disabled={!!invBusy}>
              {invBusy === 'preview' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSearch className="w-4 h-4 mr-2" />}
              Vorschau
            </Button>
            <Button onClick={() => runInvoices('generate')} disabled={!!invBusy}>
              {invBusy === 'generate' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Receipt className="w-4 h-4 mr-2" />}
              Rechnungen erzeugen
            </Button>
          </div>

          {invStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                ['Verträge', invStats.profiles],
                ['Offene Raten', invStats.planned],
                ['Bereits vorhanden', invStats.existing],
                ['Neu erzeugt', invStats.created],
              ].map(([l, v]) => (
                <Card key={l as string}><CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">{l as string}</div>
                  <div className="text-2xl font-display gold-text">{v as number}</div>
                </CardContent></Card>
              ))}
            </div>
          )}

          {invItems.length > 0 && (
            <div className="overflow-x-auto max-h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vertrag</TableHead>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>Rechnungsdatum</TableHead>
                    <TableHead>Lieferdatum</TableHead>
                    <TableHead className="text-right">Betrag</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invItems.slice(0, 300).map((r, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-xs">{r.reference_number ?? '—'}</TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{r.customer_name ?? '—'}</TableCell>
                      <TableCell className="text-xs">{r.installment_no}{r.installment_total ? ` / ${r.installment_total}` : ''}</TableCell>
                      <TableCell className="text-xs">{de(r.invoice_date)}</TableCell>
                      <TableCell className="text-xs">{de(r.delivery_date)}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">
                        {Number(r.amount ?? 0).toLocaleString('de-DE', { style: 'currency', currency: r.currency || 'EUR' })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Zusätzlich läuft täglich um 04:00 Uhr ein automatischer Lauf, der für alle Verträge mit Lieferdatum
            fehlende Monatsraten nacherzeugt.
          </p>
        </CardContent>
      </Card>
    </div>

  );
}
