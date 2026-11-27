import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Search, Plus, Pencil, RefreshCw, ExternalLink, Lock, CircleHelp, Power, Globe, Boxes, ScrollText, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { ACTIVE_COLUMN, normalizeChannel, newestLogs, previewState, type QueueLog } from '@/lib/producthub/v2Preview';
const db = supabase as any;
type Site = { code: string; name: string; base_url: string | null; is_active: boolean };
const TONES: Record<string, string> = { online: 'text-success', offline: 'text-muted-foreground', pending: 'text-warning', error: 'text-destructive', locked: 'text-muted-foreground', unknown: 'text-muted-foreground' };

async function allRows(table: string, fields: string, operation?: string) {
  const rows: any[] = [];
  for (let offset = 0; ; offset += 250) {
    let query = db.from(table).select(fields).order('id').range(offset, offset + 249);
    if (operation) query = query.eq('operation', operation);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 250) return rows;
  }
}
export default function ProductHubV2Preview() {
  const nav = useNavigate(), { roles } = useAuth();
  const superAdmin = roles?.includes('Super Admin') ?? false;
  const [enabled, setEnabled] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [products, setProducts] = useState<any[]>([]), [sites, setSites] = useState<Site[]>([]), [channels, setChannels] = useState<any[]>([]);
  const [logs, setLogs] = useState<QueueLog[]>([]), [localLogs, setLocalLogs] = useState<QueueLog[]>([]);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [selection, setSelection] = useState<Set<string>>(new Set()), [targets, setTargets] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState(''), [category, setCategory] = useState('all'), [statusFilter, setStatusFilter] = useState('all');
  const [siteOpen, setSiteOpen] = useState(false), [siteName, setSiteName] = useState(''), [siteDomain, setSiteDomain] = useState('');
  const [checks, setChecks] = useState<Record<string, string>>({}), [checking, setChecking] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data: flag, error: flagError } = await db.from('ph_settings').select('value').eq('key', 'ph2_ui_preview').maybeSingle();
      if (flagError) throw flagError;
      if (flag?.value?.enabled !== true || flag?.value?.test_only !== true) { setEnabled(false); return; }
      setEnabled(true);
      const [p,s,c,l] = await Promise.all([
        allRows('ph_products', 'id,alix_product_id,name,sku,slug,status,hero_image_url,categories,active_de,active_com,active_at,active_usa,active_dubai,updated_at'),
        allRows('ph_channels', 'id,code,name,base_url,is_active,sort_order'),
        allRows('ph_product_channels', 'id,product_id,channel_code,hold,status'),
        allRows('ph_sync_log', 'id,product_id,channel_code,status,message,created_at,payload', 'ph2_signal'),
      ]);
      setProducts(p.sort((a,b) => a.name.localeCompare(b.name, 'de')));
      setSites(s.filter(x => !['us','usa'].includes(x.code)).sort((a,b) => a.sort_order-b.sort_order));
      setChannels(c); setLogs(l);
    } catch (e) { setError(e instanceof Error ? e.message : 'Daten konnten nicht geladen werden'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const latest = useMemo(() => newestLogs(logs), [logs]);
  const channelRow = (id: string, code: string) => channels.filter(c => c.product_id === id && normalizeChannel(c.channel_code) === (normalizeChannel(code) ?? code));
  const stateFor = (p: any, code: string) => {
    const rows = channelRow(p.id, code);
    return previewState(p, code, rows.some(c => c.hold), latest[`${p.id}:${code}`], overrides[`${p.id}:${code}`], Date.now(), rows.some(c => c.status !== 'inactive') ? 'published' : 'inactive');
  };
  const categories = [...new Set<string>(products.flatMap(p => p.categories ?? []))].sort();
  const filtered = products.filter(p => (!query || `${p.name} ${p.sku ?? ''}`.toLocaleLowerCase('de').includes(query.toLocaleLowerCase('de')))
    && (category === 'all' || p.categories?.includes(category))
    && (statusFilter === 'all' || sites.some(s => stateFor(p, s.code).state === statusFilter)));
  const selectedVisible = filtered.filter(p => selection.has(p.id));
  const setTest = (p: any, site: Site, on: boolean) => {
    if (!superAdmin || channelRow(p.id, site.code).some(c => c.hold) || ['us','usa'].includes(site.code)) return;
    setOverrides(old => ({ ...old, [`${p.id}:${site.code}`]: on }));
    setLocalLogs(old => [{ id: crypto.randomUUID(), product_id: p.id, channel_code: site.code, status: 'preview',
      created_at: new Date().toISOString(), message: 'Nur Testauswahl · nichts gesendet', payload: { signal: { desired: on ? 'ONLINE' : 'OFFLINE' } } }, ...old]);
  };
  const bulk = (on: boolean) => {
    for (const p of selectedVisible) for (const s of sites) if (targets.has(s.code)) setTest(p,s,on);
  };
  const check = async (site: Site) => {
    if (!['de','com','dubai'].includes(site.code)) { setChecks(old => ({ ...old, [site.code]: 'Neues Empfangsmodul noch nicht angeschlossen' })); return; }
    setChecking(site.code);
    try {
      const { data, error } = await supabase.functions.invoke('ph-signal-admin', { body: { channel: site.code } });
      if (error) { let message = error.message; try { message = (await error.context.json()).error ?? message; } catch { /* keep original */ } throw new Error(message); }
      setChecks(old => ({ ...old, [site.code]: data.message }));
    } catch (e) { setChecks(old => ({ ...old, [site.code]: e instanceof Error ? e.message : 'Verbindungsprüfung fehlgeschlagen' })); }
    finally { setChecking(null); }
  };
  const addTestSite = () => {
    try {
      const url = new URL(siteDomain);
      if (url.protocol !== 'https:' || url.username || url.password || !siteName.trim()) throw new Error();
      setSites(old => [...old, { code: `preview-${crypto.randomUUID().slice(0,8)}`, name: siteName.trim(), base_url: url.origin, is_active: false }]);
      setSiteOpen(false); setSiteName(''); setSiteDomain('');
    } catch { toast.error('Bitte Webseitenname und gültige HTTPS-Adresse eingeben'); }
  };
  const retry = async (id: string) => {
    const { data, error } = await db.rpc('ph2_retry', { _event_id: id });
    if (error || !data) { toast.error(error?.message ?? 'Ereignis kann nicht erneut vorgemerkt werden'); return; }
    toast.success('Aktuelles Ereignis erneut vorgemerkt; produktiver Versand bleibt gesperrt'); void load();
  };
  if (!enabled && !loading && !error) return <div className="p-6"><h1 className="text-xl font-semibold">PRODUCT HUB 2.0</h1><p className="mt-4 text-muted-foreground">Testansicht nicht freigeschaltet.</p><Button className="mt-4" variant="outline" onClick={() => nav('/product-hub')}>Bisheriger PRODUCT HUB</Button></div>;
  return <div className="p-4 md:p-6 space-y-5 min-w-0">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3"><Boxes className="text-primary h-6 w-6" /><h1 className="text-xl font-semibold">PRODUCT HUB 2.0</h1><Badge variant="outline" className="text-warning border-warning">TESTBETRIEB · Versand gesperrt</Badge></div>
      <div className="flex gap-2"><Button variant="ghost" size="sm" onClick={() => nav('/product-hub')}>Bisherige Ansicht</Button><Button variant="outline" size="icon" aria-label="Aktualisieren" title="Aktualisieren" disabled={loading} onClick={() => void load()}><RefreshCw className={loading ? 'animate-spin' : ''} /></Button></div>
    </header>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <Tabs defaultValue="devices">
      <TabsList><TabsTrigger value="devices"><Boxes className="w-4 h-4 mr-2" />Geräte</TabsTrigger><TabsTrigger value="sites"><Globe className="w-4 h-4 mr-2" />Webseiten</TabsTrigger><TabsTrigger value="logs"><ScrollText className="w-4 h-4 mr-2" />Protokoll</TabsTrigger></TabsList>
      <TabsContent value="devices" className="space-y-4 mt-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-72"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={query} onChange={e => setQuery(e.target.value)} placeholder="Gerät suchen" aria-label="Gerät suchen" /></div>
          <Select value={category} onValueChange={setCategory}><SelectTrigger className="w-44" aria-label="Kategorie"><SelectValue placeholder="Kategorie" /></SelectTrigger><SelectContent><SelectItem value="all">Alle Kategorien</SelectItem>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-40" aria-label="Webseitenstatus"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Alle Status</SelectItem><SelectItem value="online">Online</SelectItem><SelectItem value="offline">Offline</SelectItem><SelectItem value="error">Fehler</SelectItem><SelectItem value="locked">Gesperrt</SelectItem><SelectItem value="unknown">Unbekannt</SelectItem></SelectContent></Select>
          <span className="text-sm text-muted-foreground">{filtered.length} Geräte</span>
          {superAdmin && <Button variant="outline" className="sm:ml-auto" onClick={() => nav('/product-hub/geraete')}><Plus className="w-4 h-4 mr-2" />Gerät hinzufügen</Button>}
        </div>
        {selectedVisible.length > 0 && <div className="flex flex-wrap items-center gap-3 border-y py-3 text-sm"><b>{selectedVisible.length} ausgewählt</b>{sites.map(s => <label key={s.code} className="flex items-center gap-2"><Checkbox checked={targets.has(s.code)} onCheckedChange={v => setTargets(old => { const next = new Set(old); v ? next.add(s.code) : next.delete(s.code); return next; })} />{s.name}</label>)}<Button size="sm" variant="outline" disabled={!superAdmin || !targets.size} onClick={() => bulk(true)}><Power className="h-4 w-4 mr-2" />AN testen</Button><Button size="sm" variant="outline" disabled={!superAdmin || !targets.size} onClick={() => bulk(false)}>AUS testen</Button></div>}
        <div className="overflow-auto max-h-[65vh] border-y">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-30 bg-background"><tr className="border-b text-left text-muted-foreground">
              <th className="sticky left-0 z-30 bg-background w-10 min-w-10 p-3"><Checkbox aria-label="Alle angezeigten Geräte auswählen" checked={filtered.length > 0 && selectedVisible.length === filtered.length} onCheckedChange={v => setSelection(v ? new Set(filtered.map(p => p.id)) : new Set())} /></th>
              <th className="sticky left-10 z-30 bg-background min-w-64 w-64 p-3">Gerät</th><th className="p-3 min-w-32">Artikelnummer</th>
              {sites.map(s => <th className="p-3 min-w-44 max-w-52 break-words" key={s.code}>{s.name}</th>)}<th className="p-3">Bearbeiten</th>
            </tr></thead>
            <tbody>{loading && !products.length ? <tr><td colSpan={sites.length+4} className="py-10 text-center text-muted-foreground">Geräte werden geladen …</td></tr> : !filtered.length ? <tr><td colSpan={sites.length+4} className="py-10 text-center text-muted-foreground">Keine Geräte gefunden.</td></tr> : filtered.map(p => <tr key={p.id} className="border-b">
              <td className="sticky left-0 z-20 bg-background p-3"><Checkbox aria-label={`${p.name} auswählen`} checked={selection.has(p.id)} onCheckedChange={v => setSelection(old => { const next = new Set(old); v ? next.add(p.id) : next.delete(p.id); return next; })} /></td>
              <td className="sticky left-10 z-20 bg-background p-3"><div className="flex items-center gap-3"><div className="w-11 h-11 shrink-0 bg-muted rounded overflow-hidden">{p.hero_image_url ? <img className="w-full h-full object-contain" src={p.hero_image_url} alt="" loading="lazy" /> : <Boxes className="w-5 h-5 m-3 text-muted-foreground" />}</div><span className="font-medium break-words max-w-44">{p.name}</span></div></td>
              <td className="p-3 text-muted-foreground">{p.sku || '—'}</td>
              {sites.map(s => { const state = stateFor(p,s.code); return <td key={s.code} className="p-3"><div className="flex items-center gap-2">
                {state.state === 'locked' ? <Lock className="h-4 w-4" aria-label="Gesperrt" /> : <Switch aria-label={`${p.name} auf ${s.name}`} checked={overrides[`${p.id}:${s.code}`] ?? (ACTIVE_COLUMN[s.code] ? p[ACTIVE_COLUMN[s.code]] === true : channelRow(p.id,s.code).some(c => c.status !== 'inactive'))} disabled={!superAdmin} onCheckedChange={v => setTest(p,s,v)} className={state.state === 'online' ? 'data-[state=checked]:bg-success' : state.state === 'error' ? 'data-[state=checked]:bg-destructive' : 'data-[state=checked]:bg-warning'} />}
                <span className={`text-xs ${TONES[state.state]}`} title={state.message}>{state.label}</span>
                {state.url && <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`${p.name} auf Webseite öffnen`} onClick={() => window.open(state.url ?? '', '_blank', 'noopener,noreferrer')}><ExternalLink className="w-3 h-3" /></Button>}
                {state.message && <CircleHelp className={`w-3 h-3 shrink-0 ${TONES[state.state]}`} aria-label={state.message}><title>{state.message}</title></CircleHelp>}
              </div>{state.state === 'error' && <div className="text-xs text-destructive mt-2 max-w-48 break-words">{state.message}</div>}</td>; })}
              <td className="p-3"><Button variant="ghost" size="icon" aria-label={`${p.name} bearbeiten`} title="Bearbeiten" onClick={() => nav(`/product-hub/geraete/${p.id}`)}><Pencil className="w-4 h-4" /></Button></td>
            </tr>)}</tbody>
          </table>
        </div>
      </TabsContent>
      <TabsContent value="sites" className="mt-5 space-y-4">
        <div className="flex justify-end"><Button variant="outline" disabled={!superAdmin} onClick={() => setSiteOpen(true)}><Plus className="w-4 h-4 mr-2" />Webseite hinzufügen</Button></div>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-muted-foreground border-b"><tr>{['Webseite','Domain','Verbindung','Online bestätigt','Letzter Abgleich',''].map((h,i) => <th className="p-3" key={i}>{h}</th>)}</tr></thead><tbody>{sites.map(s => {
          const online = products.filter(p => stateFor(p,s.code).state === 'online').length;
          const receiptTimes = Object.values(latest).filter(l => l.channel_code === s.code && l.status === 'website_confirmed').map(l => l.payload.receipt?.observed_at).filter(Boolean).sort();
          return <tr className="border-b" key={s.code}><td className="p-3 font-medium">{s.name}</td><td className="p-3 text-muted-foreground">{s.base_url ? new URL(s.base_url).hostname : 'Nicht hinterlegt'}</td><td className="p-3 max-w-72 break-words text-warning">{checks[s.code] ?? 'Testbetrieb · Abnahme ausstehend'}</td><td className="p-3">{online}</td><td className="p-3 whitespace-nowrap">{receiptTimes.length ? new Date(receiptTimes[receiptTimes.length-1]).toLocaleString('de-DE') : '—'}</td><td className="p-3"><Button size="sm" variant="outline" disabled={checking !== null} onClick={() => void check(s)}><RefreshCw className="w-4 h-4 mr-2" />Verbindung testen</Button></td></tr>;
        })}</tbody></table></div>
      </TabsContent>
      <TabsContent value="logs" className="mt-5"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-muted-foreground border-b"><tr>{['Produkt','Webseite','Aktion','Zeitpunkt','Ergebnis','Fehler / Details'].map(h => <th className="p-3" key={h}>{h}</th>)}</tr></thead><tbody>
        {[...localLogs,...logs].sort((a,b) => b.created_at.localeCompare(a.created_at)).map(l => <tr key={l.id} className="border-b"><td className="p-3">{products.find(p => p.id === l.product_id)?.name ?? '—'}</td><td className="p-3">{sites.find(s => s.code === l.channel_code)?.name ?? l.channel_code}</td><td className="p-3">{l.payload?.signal?.desired === 'ONLINE' ? 'Aktualisieren / AN' : l.payload?.signal?.desired === 'OFFLINE' ? 'AUS' : 'Änderung erfasst'}</td><td className="p-3 whitespace-nowrap">{new Date(l.created_at).toLocaleString('de-DE')}</td><td className="p-3"><Badge variant="outline" className={l.status === 'failed' ? 'text-destructive border-destructive' : l.status === 'website_confirmed' ? 'text-success border-success' : 'text-warning border-warning'}>{l.status === 'preview' ? 'Lokaler Test' : l.status === 'shadow' ? 'Schattenbetrieb' : l.status === 'website_confirmed' ? 'Bestätigt' : l.status === 'failed' ? 'Fehler' : l.status === 'superseded' ? 'Ersetzt' : 'Ausstehend'}</Badge></td><td className="p-3 max-w-80 break-words">{l.payload?.last_error ?? l.message}<details className="mt-1 text-xs text-muted-foreground"><summary className="cursor-pointer">Technische Details</summary><div className="mt-2 break-all">Ereignis: {l.id}<br />Version: {l.payload?.signal?.version ?? '—'}<br />Versuche: {l.payload?.attempts ?? 0}<br />Nächster Versuch: {l.payload?.next_attempt_at ?? '—'}</div></details>{superAdmin && l.status === 'failed' && <Button variant="ghost" size="sm" onClick={() => void retry(l.id)}><RotateCcw className="h-4 w-4 mr-2" />Erneut vormerken</Button>}</td></tr>)}
        {!logs.length && !localLogs.length && <tr><td colSpan={6} className="p-10 text-center text-muted-foreground">Noch keine Ereignisse im neuen Protokoll.</td></tr>}
      </tbody></table></div></TabsContent>
    </Tabs>
    <Dialog open={siteOpen} onOpenChange={setSiteOpen}><DialogContent><DialogHeader><DialogTitle>Webseite hinzufügen · Testbetrieb</DialogTitle></DialogHeader><label className="text-sm">Webseitenname<Input value={siteName} onChange={e => setSiteName(e.target.value)} maxLength={120} /></label><label className="text-sm">HTTPS-Domain<Input value={siteDomain} onChange={e => setSiteDomain(e.target.value)} placeholder="https://" maxLength={300} /></label><DialogFooter><Button variant="outline" onClick={() => setSiteOpen(false)}>Abbrechen</Button><Button onClick={addTestSite}>In Testansicht hinzufügen</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}