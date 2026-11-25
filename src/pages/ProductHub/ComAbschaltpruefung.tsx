import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ExternalLink, Loader2, RefreshCw, ScanEye } from 'lucide-react';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cardCheckLabel, isComCardCheck, type ComCardCheck } from '@/lib/producthub/comCardCheck';
import { toast } from 'sonner';

type Device = { id: string; name: string; active_com: boolean | null; alix_product_id: string | null };
type ResultRow = { product: Device; check: ComCardCheck | null; hold: boolean; offline: boolean };
const db = supabase as any;

export default function ComAbschaltpruefung() {
  const { roles } = useAuth();
  const allowed = roles.includes('Super Admin');
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    if (!allowed) { setLoading(false); return; }
    try {
      const all = async (table: string, columns: string, order: string, refine: (q: any) => any) => {
        const values: any[] = [];
        for (let offset = 0; ; offset += 500) {
          const { data, error: readError } = await refine(db.from(table).select(columns)).order(order).order('id').range(offset, offset + 499);
          if (readError) throw readError;
          values.push(...(data ?? []));
          if ((data ?? []).length < 500) return values;
        }
      };
      const [products, channels, logs, mappings] = await Promise.all([
        all('ph_products', 'id,name,active_com,alix_product_id', 'name', q => q),
        all('ph_product_channels', 'id,product_id,hold,remote_snapshot', 'id', q => q.eq('channel_code', 'com')),
        all('ph_sync_log', 'id,product_id,created_at,payload', 'created_at', q => q.eq('channel_code', 'com').eq('operation', 'com_card_check')),
        all('ph_lang_sync_map', 'id,product_id,remote_product_id,verified_at', 'id', q => q.eq('site_code', 'com')),
      ]);
      const latest = new Map<string, ComCardCheck>();
      for (const log of logs) if (isComCardCheck(log.payload)) latest.set(log.product_id, log.payload);
      setRows(products.flatMap((product: Device) => {
        const channel = channels.find((c: any) => c.product_id === product.id);
        if (product.active_com !== false && !channel?.hold) return [];
        const receipt = channel?.remote_snapshot?.global_offline;
        const mapping = mappings.find((m: any) => m.product_id === product.id);
        const storedCheck = latest.get(product.id);
        const check = storedCheck && storedCheck.remote_product_id === (mapping?.remote_product_id ?? null) ? storedCheck : null;
        return [{ product, hold: channel?.hold === true, check,
          offline: mapping?.verified_at && receipt?.ok === true && receipt.offline === true && receipt.status === 'OFFLINE' && receipt.channel === 'com' && receipt.hub_id === product.alix_product_id && receipt.product_id === mapping.remote_product_id }];
      }));
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Prüfprotokoll konnte nicht geladen werden.'); }
    finally { setLoading(false); }
  }, [allowed]);

  useEffect(() => {
    void load();
    const refresh = () => { if (!document.hidden) void load(); };
    window.addEventListener('ph-com-card-check', refresh);
    // Refresh stored results only; this timer never sends website commands or checks.
    const timer = window.setInterval(refresh, 15000);
    return () => { window.clearInterval(timer); window.removeEventListener('ph-com-card-check', refresh); };
  }, [load]);

  const verify = async (product: Device) => {
    if (busy) return;
    setBusy(product.id);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('ph-global-publish-device', { body: { product_id: product.id, channel: 'com', action: 'verify_com' } });
      if (invokeError) {
        let detail = invokeError.message;
        try { detail = (await invokeError.context?.json())?.error || detail; } catch { /* Keep safe fallback. */ }
        throw new Error(detail);
      }
      if (!isComCardCheck(data?.card_check)) throw new Error(data?.error || 'Prüfergebnis fehlt.');
      const check = data.card_check;
      setRows(previous => previous.map(row => row.product.id === product.id ? { ...row, check } : row));
      if (check.state === 'removed') toast.success(`${product.name}: ${cardCheckLabel(check)}`);
      else toast.warning(`${product.name}: ${check.message}`);
      if (check.recorded === false) toast.warning('Ergebnis angezeigt, aber nicht im Prüfprotokoll gespeichert.');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Prüfung fehlgeschlagen.'); }
    finally { setBusy(null); }
  };

  const filtered = useMemo(() => rows.filter(row => row.product.name.toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de')) &&
    (filter === 'all' || (row.check?.state ?? 'unchecked') === filter)), [rows, search, filter]);

  if (!allowed) return <div className="p-6 text-muted-foreground">Diese Prüfung steht nur Super Admins zur Verfügung.</div>;
  return <div className="p-4 md:p-6 space-y-6">
    <PageHeader title="COM · Abschaltprüfung" subtitle="alix-lasers.com · Öffentliche Gerätekarten" icon={ScanEye} />
    <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-y border-border py-5" aria-label="Prüfstand">
      {[['Karte verschwunden', 'removed'], ['Weiterhin sichtbar', 'visible'], ['Offen / nicht nachweisbar', 'unknown']].map(([label, state]) =>
        <div key={state}><div className="text-2xl font-semibold tabular-nums">{rows.filter(row => state === 'unknown' ? !row.check || row.check.state === 'unknown' : row.check?.state === state).length}</div><div className="text-sm text-muted-foreground">{label}</div></div>)}
    </section>
    <div className="flex flex-wrap items-center gap-3">
      <Input className="w-full sm:max-w-xs" placeholder="Gerät suchen" aria-label="Gerät suchen" value={search} onChange={e => setSearch(e.target.value)} />
      <Select value={filter} onValueChange={setFilter}><SelectTrigger className="w-full sm:w-56" aria-label="Prüfergebnis filtern"><SelectValue /></SelectTrigger><SelectContent>
        <SelectItem value="all">Alle Abschaltungen</SelectItem><SelectItem value="removed">Karte verschwunden</SelectItem><SelectItem value="visible">Weiterhin sichtbar</SelectItem><SelectItem value="unknown">Nicht nachweisbar</SelectItem><SelectItem value="unchecked">Noch nicht geprüft</SelectItem>
      </SelectContent></Select>
      <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="h-4 w-4 mr-2" />Aktualisieren</Button>
      <Button variant="outline" asChild><a href="https://www.alix-lasers.com/devices" target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 mr-2" />COM-Geräte</a></Button>
    </div>
    {error && <div role="alert" className="border border-destructive rounded p-3 text-sm text-destructive">{error}</div>}
    {loading ? <div className="flex gap-2 items-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Prüfprotokoll wird geladen…</div> :
      <Table><TableHeader><TableRow><TableHead>Gerät</TableHead><TableHead>Abschaltempfang</TableHead><TableHead>Öffentliche Karte</TableHead><TableHead>Geprüft am</TableHead><TableHead><span className="sr-only">Aktion</span></TableHead></TableRow></TableHeader><TableBody>
        {filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-muted-foreground py-8 text-center">Keine passenden Abschaltungen.</TableCell></TableRow>}
        {filtered.map(({ product, check, hold, offline }) => <TableRow key={product.id}>
          <TableCell className="min-w-44"><Link className="text-primary hover:underline" to={`/product-hub/geraete/${product.id}?tab=webseiten`}>{product.name}</Link><div className="text-xs text-muted-foreground">{hold ? 'Zurückgehalten' : 'In AlixWork deaktiviert'}</div></TableCell>
          <TableCell className="text-sm">{offline ? 'OFFLINE bestätigt' : 'Ohne OFFLINE-Nachweis'}</TableCell>
          <TableCell className="min-w-56 max-w-md"><div className={check?.state === 'removed' ? 'text-success' : check?.state === 'visible' ? 'text-destructive' : 'text-muted-foreground'}>{check?.state === 'removed' && <CheckCircle2 className="h-4 w-4 inline mr-1" />}{cardCheckLabel(check)}</div>{check && <><p className="text-xs text-muted-foreground mt-1">{check.message}</p><details className="text-xs mt-1"><summary className="cursor-pointer">Prüfdetails</summary><div className="space-y-1 py-2 break-all">{check.card_count ?? '—'} Karten · {check.attempts} Seitenabrufe<br />COM-ID: {check.remote_product_id ?? '—'}<br />Vorgang: {check.operation_id ?? '—'}{check.matched_urls?.map(url => <div key={url}>{url}</div>)}</div></details></>}</TableCell>
          <TableCell className="text-xs whitespace-nowrap">{check ? new Date(check.checked_at).toLocaleString('de-DE') : '—'}</TableCell>
          <TableCell><Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void verify(product)}>{busy === product.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ScanEye className="h-4 w-4 mr-2" />}Jetzt prüfen</Button></TableCell>
        </TableRow>)}
      </TableBody></Table>}
  </div>;
}