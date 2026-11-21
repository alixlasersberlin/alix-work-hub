import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Globe, Power, PowerOff, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PH_CHANNELS, phLabel, PH_CRITICAL_FIELDS } from '@/lib/producthub/config';
import { phUpsertChannel } from '@/lib/producthub/api';
import { pushGlobalProduct } from '@/lib/producthub/globalRelease';
import { controlDomain, type DomainAction, type DomainResult } from '@/lib/producthub/domainControl';
import { useAuth } from '@/hooks/useAuth';
import { usePhChannels } from '@/lib/producthub/useChannels';
import { websiteState } from '@/lib/producthub/websiteState';

const db = supabase as any;
const COMPARE_FIELDS = ['name', 'model', 'short_description', 'wavelengths', 'power', 'fluence', 'pulse_duration', 'frequency', 'spot_sizes', 'cooling', 'laser_class', 'mdr_status', 'ce_status', 'seo_title', 'seo_description'];

export default function ProductHubWebseiten() {
  const { roles } = useAuth();
  const canWrite = (roles || []).includes('Super Admin');
  const { channels: SITES } = usePhChannels(false);
  const [products, setProducts] = useState<any[]>([]);
  const [chan, setChan] = useState<any[]>([]);
  const [compare, setCompare] = useState<any | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [run, setRun] = useState<{ domain: string; total: number; results: DomainResult[] } | null>(null);

  const readAll = async (table: string) => {
    const rows: any[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db.from(table).select('*').order('id').range(offset, offset + 499);
      if (error) throw error;
      rows.push(...(data || []));
      if ((data || []).length < 500) return rows;
    }
  };

  const load = async () => {
    try {
      const [p, c] = await Promise.all([readAll('ph_products'), readAll('ph_product_channels')]);
      setProducts(p.sort((a, b) => a.name.localeCompare(b.name, 'de'))); setChan(c);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Webseitenübersicht konnte nicht geladen werden'); }
  };
  useEffect(() => { load(); }, []);

  const row = (pid: string, code: string) => chan.find(c => c.product_id === pid && c.channel_code === code);

  const domainAction = async (code: string, action: DomainAction, onlyId?: string) => {
    if (bulkBusy || !canWrite || ['us', 'usa'].includes(code)) return;
    const chLabel = SITES.find(c => c.code === code)?.label || code;
    const command = action === 'activate' ? 'aktivieren' : action === 'deactivate' ? 'deaktivieren' : 'gemäß der Geräteübersicht abgleichen';
    if (!window.confirm(`${onlyId ? 'Diesen Artikel' : 'Alle Artikel'} ausschließlich für ${chLabel} ${command}? Andere Domains und Preise bleiben unverändert. Gesperrte Vorgänge bleiben gesperrt.`)) return;
    setBulkBusy(true);
    try {
      const { data: allowed, error: roleError } = await supabase.rpc('has_role', { check_role: 'Super Admin' });
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (roleError || authError || !allowed || !user) throw new Error('Aktive Super-Admin-Anmeldung erforderlich');
      const [fresh, channelRows, mappings] = await Promise.all([readAll('ph_products'), readAll('ph_product_channels'), readAll('ph_lang_sync_map')]);
      const targets = onlyId ? fresh.filter(p => p.id === onlyId) : fresh;
      setRun({ domain: chLabel, total: targets.length, results: [] });
      await controlDomain(targets, { code, name: chLabel, is_active: SITES.find(s => s.code === code)?.is_active === true }, action, channelRows, mappings, {
        updateProduct: async (id, patch) => {
          const { error } = await db.from('ph_products').update({ ...patch, updated_by: user.id }).eq('id', id);
          if (error) throw error;
        },
        updateChannel: phUpsertChannel,
        pushGlobal: async (id, channel) => { await pushGlobalProduct(id, channel); },
      }, result => setRun(previous => previous ? { ...previous, results: [...previous.results, result] } : previous));
    } catch (e: any) {
      toast.error(e.message || 'Domainänderung fehlgeschlagen');
    } finally {
      await load();
      setBulkBusy(false);
    }
  };

  const diffs = useMemo(() => {
    if (!compare) return [];
    return PH_CHANNELS.filter(c => ['com', 'de'].includes(c.code)).flatMap(ch => {
      const r = row(compare.id, ch.code);
      const snap = r?.remote_snapshot || {};
      return COMPARE_FIELDS
        .filter(f => snap[f] !== undefined && String(snap[f] ?? '') !== String(compare[f] ?? ''))
        .map(f => ({ channel: ch.short, field: f, master: compare[f], remote: snap[f] }));
    });
  }, [compare, chan]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="Product Hub · Webseiten" subtitle="Freigabestelle: AlixWork · Super Admin" icon={Globe} />
      <section className="divide-y divide-border border-y border-border" aria-label="Domainsteuerung">
        {SITES.map(site => {
          const active = products.filter(p => websiteState(p, site.code, row(p.id, site.code)).active).length;
          const excluded = ['us', 'usa'].includes(site.code);
          return <div key={site.code} className="flex flex-wrap items-center gap-3 py-4">
            <div className="min-w-0 flex-1"><h2 className="font-semibold break-words">{site.label}</h2>
              <p className="text-sm text-muted-foreground">AlixWork: {active} aktiv · {products.length - active} deaktiviert / zurückgehalten{excluded ? ' · ausgenommen' : ''}</p>
              {!excluded && <span className="text-xs text-muted-foreground">{['com', 'de', 'beautyco'].includes(site.code) ? 'Direkter Freigabe- und Abschaltversand' : 'Abrufanschluss · direkter Freigabe- und Abschaltversand fehlt'}</span>}
            </div>
            {canWrite && !excluded && <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={bulkBusy || !products.length} onClick={() => domainAction(site.code, 'sync')}><RefreshCw className="mr-2 h-4 w-4" />Abgleich senden</Button>
              <Button disabled={bulkBusy || !products.length || !site.is_active} onClick={() => domainAction(site.code, 'activate')}><Power className="mr-2 h-4 w-4" />Alle aktivieren</Button>
              <Button variant="destructive" disabled={bulkBusy || !products.length} onClick={() => domainAction(site.code, 'deactivate')}><PowerOff className="mr-2 h-4 w-4" />Alle deaktivieren</Button>
            </div>}
          </div>;
        })}
      </section>
      {run && <section aria-live="polite" className="space-y-3">
        <h2 className="font-semibold">{run.domain} · {run.results.length} / {run.total}{bulkBusy ? ' · läuft' : ' · abgeschlossen'}</h2>
        <Table><TableHeader><TableRow><TableHead>Artikel</TableHead><TableHead>Ziel</TableHead><TableHead>Ergebnis</TableHead></TableRow></TableHeader>
          <TableBody>{run.results.map(result => <TableRow key={result.id}><TableCell>{result.name}</TableCell><TableCell>{result.active ? 'Aktiv' : 'OFFLINE'}</TableCell><TableCell className="max-w-lg break-words">
            <span className={result.confirmed ? 'text-success' : 'text-muted-foreground'}>{result.note}</span>
            {result.receipt !== undefined && <details><summary className="cursor-pointer">OFFLINE-Antwort</summary><pre className="whitespace-pre-wrap break-all text-xs">{JSON.stringify(result.receipt, null, 2)}</pre></details>}
          </TableCell></TableRow>)}</TableBody></Table>
      </section>}
      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Gerät</TableHead>
            {SITES.map(c => <TableHead key={c.code}>{c.short}</TableHead>)}
            <TableHead>Aktionen</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {products.length === 0 && <TableRow><TableCell colSpan={SITES.length + 2} className="text-center py-8 text-muted-foreground">Keine Produkte importiert.</TableCell></TableRow>}
            {products.map(p => (
              <TableRow key={p.id}>
                <TableCell><Link to={`/product-hub/geraete/${p.id}`} className="text-primary hover:underline">{p.name}</Link></TableCell>
                {SITES.map(c => {
                  const r = row(p.id, c.code);
                  const state = websiteState(p, c.code, r);
                  const excluded = ['us', 'usa'].includes(c.code);
                  return (
                    <TableCell key={c.code} className="text-xs">
                      <div className="flex flex-col gap-0.5">
                        {canWrite && !excluded ? <Button size="sm" variant="outline" disabled={bulkBusy || (!state.active && !c.is_active)}
                          className={state.active ? 'w-fit border-success text-success' : 'w-fit border-destructive text-destructive'}
                          aria-label={`${p.name} auf ${c.label} ${state.active ? 'deaktivieren' : 'aktivieren'}`}
                          onClick={() => domainAction(c.code, state.active ? 'deactivate' : 'activate', p.id)}>
                          {state.active ? <Power className="mr-1 h-3 w-3" /> : <PowerOff className="mr-1 h-3 w-3" />}{state.label}
                        </Button> : <Badge variant="outline" className={state.active ? 'w-fit border-success text-success' : 'w-fit border-destructive text-destructive'}>{state.label}</Badge>}
                        <span className={state.confirmed ? 'text-success' : 'text-muted-foreground'}>{excluded ? 'US ausgenommen' : state.delivery}</span>
                        {r?.hold && <span className="text-muted-foreground">Zurückgehalten</span>}
                      </div>
                    </TableCell>
                  );
                })}
                <TableCell className="space-x-1 whitespace-nowrap">
                  <Button size="sm" variant="outline" onClick={() => setCompare(p)}>Vergleich</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={!!compare} onOpenChange={o => !o && setCompare(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Vergleich: ALIXWORK MASTER ↔ COM ↔ DE — {compare?.name}</DialogTitle></DialogHeader>
          {diffs.length === 0
            ? <div className="text-sm text-muted-foreground">Keine Abweichungen bekannt (noch kein Website-Snapshot importiert).</div>
            : (
              <Table>
                <TableHeader><TableRow><TableHead>Kanal</TableHead><TableHead>Feld</TableHead><TableHead>Master</TableHead><TableHead>Website</TableHead></TableRow></TableHeader>
                <TableBody>
                  {diffs.map((d, i) => (
                    <TableRow key={i} className={PH_CRITICAL_FIELDS.includes(d.field) ? 'bg-amber-500/5' : ''}>
                      <TableCell>{d.channel}</TableCell>
                      <TableCell className="text-xs">{phLabel(d.field)}</TableCell>
                      <TableCell className="text-xs text-emerald-500 max-w-[220px] truncate">{String(d.master ?? '—')}</TableCell>
                      <TableCell className="text-xs text-amber-500 max-w-[220px] truncate">{String(d.remote ?? '—')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
