import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, CheckCircle2, Globe, Loader2, PlayCircle, RotateCcw, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { PH_LOCALES } from '@/lib/producthub/i18n';
import {
  PH_SYNC_FIELD_LABEL, phSyncDryRun, phSyncPreview, phSyncPublish, phSyncRollback,
  phSyncRunFields, phSyncRuns, phSyncTargets,
  type PhSyncResponse,
} from '@/lib/producthub/websiteSync';
import { phListProducts } from '@/lib/producthub/api';
import type { PhProduct } from '@/lib/producthub/config';

const PILOT_ID = 'dcb978ce-6b71-45c6-8da8-3ede23111b99'; // Alix BlueIce Smart KI

const RESULT_TONE: Record<string, string> = {
  ok: 'bg-emerald-500/15 text-emerald-500',
  pending: 'bg-muted text-muted-foreground',
  blocked: 'bg-amber-500/15 text-amber-500',
  failed: 'bg-destructive/15 text-destructive',
  rolled_back: 'bg-sky-500/15 text-sky-500',
};
const RESULT_LABEL: Record<string, string> = {
  ok: 'Erfolgreich', pending: 'Läuft', blocked: 'Blockiert', failed: 'Fehler', rolled_back: 'Zurückgenommen',
};

export function WebsiteSyncPanel({ productId, canWrite }: { productId?: string; canWrite: boolean }) {
  const [products, setProducts] = useState<PhProduct[]>([]);
  const [pid, setPid] = useState<string>(productId || PILOT_ID);
  const [locale, setLocale] = useState('en');
  const [targets, setTargets] = useState<any[]>([]);
  const [res, setRes] = useState<PhSyncResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [detail, setDetail] = useState<{ run: any; fields: any[] } | null>(null);
  const [fResult, setFResult] = useState('all');

  useEffect(() => { if (!productId) phListProducts().then(setProducts).catch(() => {}); }, [productId]);
  useEffect(() => { setPid(productId || PILOT_ID); }, [productId]);

  const loadRuns = async () => { try { setRuns(await phSyncRuns(pid)); } catch { /* ignore */ } };
  useEffect(() => { loadRuns(); /* eslint-disable-next-line */ }, [pid]);

  const run = async (kind: 'targets' | 'preview' | 'dryrun' | 'publish') => {
    setBusy(kind);
    try {
      if (kind === 'targets') { const r = await phSyncTargets(pid); setTargets(r as any ? (r as any).targets || [] : []); }
      else if (kind === 'preview') setRes(await phSyncPreview(pid, locale));
      else if (kind === 'dryrun') { const r = await phSyncDryRun(pid, locale); setRes(r); await loadRuns(); toast.success('Testlauf abgeschlossen – nichts veröffentlicht'); }
      else {
        const r = await phSyncPublish(pid, locale);
        setRes(r); await loadRuns();
        if (r.error) toast.error(r.error); else toast.success(`${r.published ?? 0} Felder übertragen`);
      }
    } catch (e: any) { toast.error(e.message || 'Fehlgeschlagen'); }
    finally { setBusy(null); }
  };

  const rollback = async (r: any, force = false) => {
    if (!window.confirm(`Sync vom ${new Date(r.created_at).toLocaleString('de-DE')} zurücknehmen?`)) return;
    setBusy('rollback');
    try {
      const out = await phSyncRollback(r.product_id, r.locale, r.id, force);
      if (out.error && out.conflicts?.length) {
        if (window.confirm(`${out.error}\n\nTrotzdem zurücknehmen?`)) await rollback(r, true);
      } else if (out.error) toast.error(out.error);
      else toast.success('Sync zurückgenommen');
      await loadRuns();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  const openDetail = async (r: any) => {
    try { setDetail({ run: r, fields: await phSyncRunFields(r.id) }); }
    catch (e: any) { toast.error(e.message); }
  };

  const filteredRuns = useMemo(
    () => runs.filter(r => fResult === 'all' || r.result === fResult),
    [runs, fResult],
  );

  const s = res?.summary;

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 flex flex-wrap items-end gap-3">
        {!productId && (
          <div className="space-y-1">
            <Label className="text-xs">Gerät</Label>
            <Select value={pid} onValueChange={setPid}>
              <SelectTrigger className="w-[280px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1">
          <Label className="text-xs">Sprache</Label>
          <Select value={locale} onValueChange={setLocale}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PH_LOCALES.map(l => <SelectItem key={l.code} value={l.code}>{l.flag} {l.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" disabled={!!busy} onClick={() => run('targets')}>
          {busy === 'targets' ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Globe className="w-4 h-4 mr-1" />}
          Zielzuordnung prüfen
        </Button>
        <Button variant="outline" disabled={!!busy} onClick={() => run('preview')}>
          {busy === 'preview' ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Vorschau
        </Button>
        <Button disabled={!!busy} onClick={() => run('dryrun')}>
          {busy === 'dryrun' ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <PlayCircle className="w-4 h-4 mr-1" />}
          Testlauf – nichts veröffentlichen
        </Button>
        <Button variant="secondary" disabled={!!busy || !canWrite || !s?.publish_allowed}
          title={s?.publish_allowed ? '' : 'Erst nach Testlauf und Freigabe der Zielstruktur möglich'}
          onClick={() => run('publish')}>
          <Upload className="w-4 h-4 mr-1" /> Produktiv synchronisieren
        </Button>
      </CardContent></Card>

      {targets.length > 0 && (
        <Card><CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Sprache</TableHead><TableHead>Zielwebsite</TableHead><TableHead>Erreichbar</TableHead>
              <TableHead>Sprachcontainer</TableHead><TableHead>Zielprodukt</TableHead><TableHead>Struktur</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {targets.map(t => (
                <TableRow key={t.locale}>
                  <TableCell className="uppercase">{t.locale}</TableCell>
                  <TableCell>{t.site_label}</TableCell>
                  <TableCell>{t.reachable ? <span className="text-emerald-500">HTTP {t.http}</span> : <span className="text-destructive">{t.http || t.http_error || '—'}</span>}</TableCell>
                  <TableCell className="text-xs">{t.locale_container || <span className="text-amber-500">nicht vorhanden</span>}</TableCell>
                  <TableCell className="text-xs">{t.remote_found ? 'gefunden' : <span className="text-amber-500">keine Zuordnung</span>}</TableCell>
                  <TableCell><Badge variant="outline">{t.structure_status}</Badge>{t.publish_enabled ? ' ✓' : ''}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}

      {s && (
        <Card><CardContent className="p-4 space-y-3">
          <div className="grid gap-2 md:grid-cols-4 text-sm">
            <div><div className="text-xs text-muted-foreground">Quelle</div>{s.source}</div>
            <div><div className="text-xs text-muted-foreground">Gerät</div>{s.product}</div>
            <div><div className="text-xs text-muted-foreground">Sprache</div>{s.locale.toUpperCase()}</div>
            <div><div className="text-xs text-muted-foreground">Ziel</div>{s.site}</div>
            <div><div className="text-xs text-muted-foreground">Hub-ID</div><span className="text-xs">{s.hub_id}</span></div>
            <div><div className="text-xs text-muted-foreground">Zielprodukt-ID</div><span className="text-xs">{s.remote_product_id || '—'}</span></div>
            <div><div className="text-xs text-muted-foreground">Geprüfte Felder</div>{s.fields_checked} · geändert {s.fields_changed} · unverändert {s.fields_unchanged}</div>
            <div><div className="text-xs text-muted-foreground">Veröffentlichung möglich</div>
              {s.publish_allowed ? <span className="text-emerald-500">ja</span> : <span className="text-amber-500">nein</span>}</div>
          </div>
          {s.fallback_detected && (
            <div className="flex items-center gap-2 text-sm text-amber-500 bg-amber-500/10 rounded p-2">
              <AlertTriangle className="w-4 h-4" /> Deutscher Fallback erkannt – wird nicht als {s.locale.toUpperCase()}-Inhalt gespeichert.
            </div>
          )}
          {(res?.errors || []).map((e, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded p-2">
              <AlertTriangle className="w-4 h-4" /> {e}
            </div>
          ))}
          {(res?.warnings || []).map((w, i) => (
            <div key={i} className="text-xs text-amber-500 bg-amber-500/10 rounded p-2">{w}</div>
          ))}
          <Table>
            <TableHeader><TableRow>
              <TableHead>Feld</TableHead><TableHead>Aktuell Website</TableHead>
              <TableHead>Product Hub</TableHead><TableHead>Aktion</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(res?.plan || []).map(p => (
                <TableRow key={p.field} className={p.action === 'change' ? 'bg-emerald-500/5' : p.action === 'blocked' ? 'bg-amber-500/5' : ''}>
                  <TableCell className="text-xs">{PH_SYNC_FIELD_LABEL[p.field] || p.field}</TableCell>
                  <TableCell className="text-xs max-w-[260px] truncate" title={p.site || ''}>{p.site || '—'}</TableCell>
                  <TableCell className="text-xs max-w-[260px] truncate" title={p.hub || ''}>{p.hub || '—'}</TableCell>
                  <TableCell className="text-xs">
                    {p.action === 'change' && <span className="text-emerald-500 font-medium">ÄNDERN</span>}
                    {p.action === 'unchanged' && <span className="text-muted-foreground">KEINE ÄNDERUNG</span>}
                    {p.action === 'blocked' && <span className="text-amber-500" title={p.message}>BLOCKIERT</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}

      <Card><CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Änderungsprotokoll</span>
          <Select value={fResult} onValueChange={setFResult}>
            <SelectTrigger className="w-[180px] h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              <SelectItem value="ok">Erfolgreich</SelectItem>
              <SelectItem value="blocked">Blockiert</SelectItem>
              <SelectItem value="failed">Fehler</SelectItem>
              <SelectItem value="rolled_back">Zurückgenommen</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Zeit</TableHead><TableHead>Sprache</TableHead><TableHead>Ziel</TableHead>
              <TableHead>Art</TableHead><TableHead>Felder</TableHead><TableHead>Ergebnis</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filteredRuns.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Noch keine Läufe.</TableCell></TableRow>}
              {filteredRuns.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{new Date(r.created_at).toLocaleString('de-DE')}</TableCell>
                  <TableCell className="uppercase text-xs">{r.locale}</TableCell>
                  <TableCell className="text-xs">{r.site_label}</TableCell>
                  <TableCell className="text-xs">{r.mode === 'dry_run' ? 'Testlauf' : r.mode === 'publish' ? 'Produktiv' : 'Rücknahme'}</TableCell>
                  <TableCell className="text-xs">{r.fields_changed}/{r.fields_checked}</TableCell>
                  <TableCell><span className={`text-xs px-2 py-0.5 rounded ${RESULT_TONE[r.result]}`}>{RESULT_LABEL[r.result] || r.result}</span></TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => openDetail(r)}>Details</Button>
                    {canWrite && r.mode === 'publish' && r.result === 'ok' && !r.rolled_back_at && (
                      <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => rollback(r)}>
                        <RotateCcw className="w-3.5 h-3.5 mr-1" /> Diesen Sync zurücknehmen
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent></Card>

      <Dialog open={!!detail} onOpenChange={o => !o && setDetail(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Sync-Protokoll · {detail?.run?.locale?.toUpperCase()} → {detail?.run?.site_label}</DialogTitle></DialogHeader>
          <div className="text-xs text-muted-foreground space-y-1">
            <div>Sync-ID: {detail?.run?.id}</div>
            <div>Hub-ID: {detail?.run?.product_id} · Zielprodukt: {detail?.run?.remote_product_id || '—'}</div>
            <div>Zeit: {detail && new Date(detail.run.created_at).toLocaleString('de-DE')}</div>
            {(detail?.run?.errors || []).map((e: string, i: number) => <div key={i} className="text-destructive">{e}</div>)}
            {(detail?.run?.warnings || []).map((w: string, i: number) => <div key={i} className="text-amber-500">{w}</div>)}
          </div>
          <div className="max-h-[50vh] overflow-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Feld</TableHead><TableHead>Vorher</TableHead><TableHead>Nachher</TableHead><TableHead>Aktion</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(detail?.fields || []).map(f => (
                  <TableRow key={f.id}>
                    <TableCell className="text-xs">{PH_SYNC_FIELD_LABEL[f.field] || f.field}</TableCell>
                    <TableCell className="text-xs max-w-[240px] truncate" title={f.value_before || ''}>{f.value_before || '—'}</TableCell>
                    <TableCell className="text-xs max-w-[240px] truncate" title={f.value_after || ''}>{f.value_after || '—'}</TableCell>
                    <TableCell className="text-xs">{f.action}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
