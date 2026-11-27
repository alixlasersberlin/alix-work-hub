import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const db = supabase as any;
const MODES = { blocked: 'Gesperrt', pilot: 'Pilotbetrieb', full: 'Vollständiger Produktivbetrieb' };
const CHECKS = { receiver_readiness: 'Empfänger unterstützt Einzelgeräte-Pilot', data: 'Gerätedaten aktualisiert', images: 'Produktbilder aktualisiert', technical: 'Technische Daten aktualisiert', offline: 'Gerät offline geschaltet', online: 'Gerät wieder online geschaltet', cache: 'Cache auf allen Serverinstanzen invalidiert', display: 'Tatsächliche Darstellung auf der Webseite' };
type Mode = keyof typeof MODES;
type Check = keyof typeof CHECKS;
const NAMES = { de: 'alix-lasers.de', com: 'alix-lasers.com' };
const format = (s?: string) => s ? new Date(s).toLocaleString('de-DE') : '—';
export const OPERATING_QUERY = ['ph2-operating-control'];

export function ProductionControl({ canWrite, products }: { canWrite: boolean; products: { id: string; name: string }[] }) {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<'de' | 'com' | null>(null);
  const [mode, setMode] = useState<Mode>('blocked');
  const [pilot, setPilot] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [checkSite, setCheckSite] = useState<'de' | 'com'>('de');
  const [checkProduct, setCheckProduct] = useState('');
  const [check, setCheck] = useState<Check>('receiver_readiness');
  const [passed, setPassed] = useState(false);
  const [evidence, setEvidence] = useState('');
  const [event, setEvent] = useState('');
  const [page, setPage] = useState(0);
  const { data, error, isPending } = useQuery({
    queryKey: [...OPERATING_QUERY, page],
    queryFn: async () => {
      const [g, l, env] = await Promise.all([
        db.from('ph_settings').select('value').eq('key', 'ph2_activation').maybeSingle(),
        db.from('ph_sync_log').select('*').in('operation', ['ph2_signal', 'ph2_mode_change', 'ph2_emergency_stop', 'ph2_pilot_check']).order('created_at', { ascending: false }).order('id').range(page * 50, page * 50 + 49),
        supabase.functions.invoke('ph-signal-admin', { body: { action: 'overview' } }),
      ]);
      if (g.error || l.error) throw g.error || l.error;
      return { gate: g.data?.value ?? {}, logs: l.data ?? [], enabled: !env.error && env.data?.live_enabled === true };
    },
    refetchInterval: 10000,
  });
  const { data: proofData } = useQuery({ queryKey: [...OPERATING_QUERY, 'proofs', checkSite, checkProduct], enabled: !!checkProduct, queryFn: async () => {
    const [checks, signals] = await Promise.all([
      db.from('ph_sync_log').select('*').eq('operation','ph2_pilot_check').eq('channel_code',checkSite).eq('product_id',checkProduct).order('created_at',{ascending:false}).limit(100),
      db.from('ph_sync_log').select('*').eq('operation','ph2_signal').eq('channel_code',checkSite).eq('product_id',checkProduct).eq('status','website_confirmed').order('created_at',{ascending:false}).limit(100),
    ]);
    if (checks.error || signals.error) throw checks.error || signals.error;
    return { checks: checks.data ?? [], events: signals.data ?? [] };
  }, refetchInterval: 10000 });
  const invalidate = () => qc.invalidateQueries({ queryKey: OPERATING_QUERY });
  const save = useMutation({ mutationFn: async () => {
    const { error } = await db.rpc('ph2_set_operating_mode', { _channel: edit, _mode: mode, _pilot: pilot || null, _confirmation: confirmation, _revision: data?.gate.revision ?? 0 });
    if (error) throw error;
  }, onSuccess: async () => { setEdit(null); await invalidate(); toast.success('Betriebsmodus ausdrücklich gespeichert'); }, onError: (e: any) => toast.error(e.message || 'Freigabe gesperrt') });
  const stop = useMutation({ mutationFn: async () => { const { error } = await db.rpc('ph2_stop_production'); if (error) throw error; }, onSuccess: async () => { await invalidate(); toast.success('DE und COM: weitere produktive Übertragungen gesperrt'); }, onError: (e: any) => toast.error(e.message || 'Stopp fehlgeschlagen; nicht bestätigt') });
  const record = useMutation({ mutationFn: async () => {
    const { error } = await db.rpc('ph2_record_pilot_check', { _channel: checkSite, _product: checkProduct, _check: check, _passed: passed, _evidence: evidence, _event: event || null });
    if (error) throw error;
  }, onSuccess: async () => { setEvidence(''); await invalidate(); toast.success('Prüfnachweis protokolliert'); }, onError: (e: any) => toast.error(e.message || 'Prüfnachweis nicht gespeichert') });
  const g = data?.gate ?? {};
  const events = proofData?.events ?? [];
  const selectedLogs = proofData?.checks ?? [];
  const targetConfirmation = edit ? `FREIGABE ${edit.toUpperCase()} ${mode.toUpperCase()}` : '';
  const open = (site: 'de' | 'com') => { setEdit(site); setMode(g.channels?.[site]?.mode ?? 'blocked'); setPilot(g.channels?.[site]?.pilot_product_id ?? ''); setConfirmation(''); };
  return <Card><CardContent className="p-4 space-y-5">
    <div className="flex flex-wrap justify-between items-start gap-3">
      <div><h2 className="font-semibold">Kontrollierte Produktivfreigabe · DE / COM</h2><p className="text-xs text-muted-foreground mt-1">Nur Super Admin · Keine automatische Freigabe oder Erweiterung auf weitere Geräte</p></div>
      {canWrite && <Button variant="destructive" disabled={stop.isPending || isPending || !!error} onClick={() => stop.mutate()}>Produktivbetrieb sofort stoppen</Button>}
    </div>
    {error && <p role="alert" className="text-destructive">Betriebsstatus konnte nicht geladen werden: {(error as any).message}. Freigaben bleiben gesperrt.</p>}
    {isPending ? <p>Lade Betriebsstatus…</p> : <div className="grid gap-3 md:grid-cols-2">{(['de', 'com'] as const).map(site => {
      const state = g.channels?.[site]; const m: Mode = state?.mode ?? 'blocked';
      const effective = !error && data?.enabled && g.enabled === true && g.emergency_stopped === false && m !== 'blocked';
      return <section key={site} aria-label={`Betriebsmodus ${NAMES[site]}`} className="rounded-md border p-3 space-y-2">
        <div className="flex justify-between gap-2"><strong className="text-sm">{NAMES[site]}</strong><Badge variant={effective ? 'default' : 'secondary'}>{effective ? MODES[m] : 'Gesperrt'}</Badge></div>
        <p className="text-xs">Gespeicherter Betriebsmodus: {MODES[m]}</p>
        <p className="text-xs">Pilotgerät: {products.find(p => p.id === state?.pilot_product_id)?.name ?? 'Noch nicht ausgewählt'}</p>
        {!effective && m !== 'blocked' && <p className="text-xs text-muted-foreground">Übertragung weiterhin gesperrt: übergeordnete Sicherheitsfreigabe nicht aktiv.</p>}
        {canWrite && <Button size="sm" variant="outline" disabled={!!error} onClick={() => open(site)}>Betriebsmodus ändern · {site.toUpperCase()}</Button>}
      </section>;
    })}</div>}
    <div className="text-xs text-muted-foreground space-y-1">
      <p>Vollsicherung: {g.backup_verified === true ? 'nachgewiesen' : 'Nachweis fehlt'} · Wiederherstellung: {g.restore_verified === true ? 'nachgewiesen' : 'Nachweis fehlt'} · Kommunikationsfreigabe: {g.communication_verified === true ? 'nachgewiesen' : 'Nachweis fehlt'}</p>
      <p>Ein Stopp sperrt weitere Übertragungen. Bereits versendete Anfragen können nicht zurückgerufen werden; Geräte werden dadurch nicht gelöscht oder automatisch offline geschaltet.</p>
    </div>
    <details className="rounded-md border p-3" open>
      <summary className="text-sm font-medium cursor-pointer">Pilot-Synchronisationsprüfung und Nachweise</summary>
      <p className="text-xs text-muted-foreground my-3">Darstellung, Inhalte und Cache-Abgleich werden mit konkretem Prüfnachweis dokumentiert. Eine signierte Rückmeldung allein beweist weder korrekte Bilder noch die Aktualisierung aller Serverinstanzen.</p>
      <div className="grid gap-3 md:grid-cols-2">
        <div><Label htmlFor="check-site">Zielwebseite</Label><select id="check-site" className="w-full border rounded-md bg-background p-2 text-sm" value={checkSite} onChange={e => { setCheckSite(e.target.value as 'de' | 'com'); setEvent(''); }}><option value="de">alix-lasers.de</option><option value="com">alix-lasers.com</option></select></div>
        <div><Label htmlFor="check-device">Prüfgerät</Label><select id="check-device" className="w-full border rounded-md bg-background p-2 text-sm" value={checkProduct} onChange={e => { setCheckProduct(e.target.value); setEvent(''); }}><option value="">Gerät auswählen</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
      </div>
      <Table><TableHeader><TableRow><TableHead>Prüfung</TableHead><TableHead>Ergebnis</TableHead><TableHead>Nachweis / Ursache</TableHead></TableRow></TableHeader><TableBody>
        {(Object.keys(CHECKS) as Check[]).map(k => { const l = selectedLogs.find((l: any) => l.payload?.check === k); return <TableRow key={k}><TableCell className="text-xs">{CHECKS[k]}</TableCell><TableCell><Badge variant={l?.payload?.passed ? 'default' : l ? 'destructive' : 'outline'}>{l ? l.payload.passed ? 'Mit Nachweis geprüft' : 'Fehlgeschlagen' : 'Ausstehend'}</Badge></TableCell><TableCell className="text-xs whitespace-pre-wrap">{l?.message ?? 'Kein Prüfnachweis vorhanden'}</TableCell></TableRow>; })}
        <TableRow><TableCell className="text-xs">Signierte Empfangsbestätigung</TableCell><TableCell><Badge variant={events.length ? 'default' : 'outline'}>{events.length ? 'Passend empfangen' : 'Ausstehend'}</Badge></TableCell><TableCell className="text-xs">Nur authentifizierte, geräte-, kanal- und versionsgleiche Rückmeldungen zählen.</TableCell></TableRow>
      </TableBody></Table>
      {canWrite && <div className="grid gap-3 mt-3">
        <div><Label htmlFor="pilot-check">Prüfschritt</Label><select id="pilot-check" className="w-full border rounded-md bg-background p-2 text-sm" value={check} onChange={e => setCheck(e.target.value as Check)}>{(Object.keys(CHECKS) as Check[]).map(k => <option key={k} value={k}>{CHECKS[k]}</option>)}</select></div>
        {check !== 'receiver_readiness' && <div><Label htmlFor="pilot-event">Passende bestätigte Übertragung</Label><select id="pilot-event" className="w-full border rounded-md bg-background p-2 text-sm" value={event} onChange={e => setEvent(e.target.value)}><option value="">Übertragung auswählen</option>{events.map((l: any) => <option key={l.id} value={l.id}>{format(l.created_at)} · {l.payload?.receipt?.state} · {l.id}</option>)}</select></div>}
        <div><Label htmlFor="pilot-evidence">Konkreter Prüfnachweis oder technische Fehlerursache</Label><Textarea id="pilot-evidence" maxLength={2000} value={evidence} onChange={e => setEvidence(e.target.value)} placeholder="Geprüfte URL, Zeitpunkt, Server-/Browsernachweis und Ergebnis; keine Schlüssel eintragen" /></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={passed} onChange={e => setPassed(e.target.checked)} />Prüfung anhand des angegebenen Nachweises erfolgreich</label>
        <Button className="justify-self-start" variant="outline" disabled={record.isPending || !checkProduct || evidence.trim().length < 10 || (passed && check !== 'receiver_readiness' && !event)} onClick={() => record.mutate()}>Prüfnachweis speichern</Button>
      </div>}
    </details>
    <div className="space-y-2"><h3 className="text-sm font-medium">Produktive Übertragungen und Freigabeprotokoll</h3><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Zeitpunkt</TableHead><TableHead>Gerät / Zielwebseite</TableHead><TableHead>Übertragene Änderungen</TableHead><TableHead>Empfangsbestätigung</TableHead><TableHead>Ergebnis / Ursache</TableHead></TableRow></TableHeader><TableBody>
      {(data?.logs ?? []).map((l: any) => <TableRow key={l.id}><TableCell className="text-xs">{format(l.created_at)}</TableCell><TableCell className="text-xs">{products.find(p => p.id === l.product_id)?.name ?? l.product_id ?? 'Betriebssteuerung'}<br />{NAMES[l.channel_code as keyof typeof NAMES] ?? 'DE und COM'}<br /><span className="font-mono">{l.id}</span></TableCell><TableCell className="text-xs">{l.operation === 'ph2_signal' ? <>{l.payload?.changed_sources?.join(', ') ?? l.payload?.source ?? 'Gerätedaten'}<br />Soll: {l.payload?.signal?.desired ?? 'Entscheidung ausstehend'}<br />Version: {l.payload?.signal?.version}<br />{l.direction === 'shadow' ? 'Nur Schattenprotokoll · nicht übertragen' : `Letzter Versuch: ${format(l.payload?.attempted_at)}`}</> : l.operation}</TableCell><TableCell className="text-xs">{l.payload?.receipt ? <>{l.payload.receipt.state}<br />{l.payload.receipt.version}<br />{format(l.payload.receipt.observed_at)}</> : 'Nicht bestätigt'}</TableCell><TableCell className="text-xs whitespace-pre-wrap">{l.status}<br />{l.message}<br />{l.payload?.last_error}</TableCell></TableRow>)}
      {!data?.logs.length && <TableRow><TableCell colSpan={5} className="text-muted-foreground text-sm">Noch keine Übertragungen oder Prüfnachweise auf dieser Seite.</TableCell></TableRow>}
    </TableBody></Table></div><div className="flex gap-2 items-center"><Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Neuere Einträge</Button><span className="text-xs">Seite {page + 1}</span><Button size="sm" variant="outline" disabled={(data?.logs.length ?? 0) < 50} onClick={() => setPage(p => p + 1)}>Ältere Einträge</Button><Button size="sm" variant="ghost" onClick={() => invalidate()}>Protokoll aktualisieren</Button></div></div>
    <Dialog open={!!edit} onOpenChange={v => !v && setEdit(null)}><DialogContent><DialogHeader><DialogTitle>Betriebsmodus · {edit && NAMES[edit]}</DialogTitle></DialogHeader>
      <Label htmlFor="operating-mode">Neuer Betriebsmodus</Label><select id="operating-mode" className="w-full border rounded-md bg-background p-2" value={mode} onChange={e => { setMode(e.target.value as Mode); setConfirmation(''); }}>{(Object.keys(MODES) as Mode[]).map(k => <option value={k} key={k}>{MODES[k]}</option>)}</select>
      {mode === 'pilot' && <><Label htmlFor="pilot-device">Genau ein Pilotgerät</Label><select id="pilot-device" className="w-full border rounded-md bg-background p-2" value={pilot} onChange={e => setPilot(e.target.value)}><option value="">Gerät auswählen</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></>}
      <p className="text-sm text-muted-foreground">Keine Preise, Produktdaten oder Schlüssel werden geändert. Frühere Ereignisse werden nicht nachträglich übertragen. Vollbetrieb benötigt die vollständige Pilotprüfung. Alle bisherigen Sicherheitsvoraussetzungen bleiben bestehen.</p>
      <Label htmlFor="mode-confirmation">Zur ausdrücklichen Bestätigung eingeben: <strong>{targetConfirmation}</strong></Label><Input id="mode-confirmation" value={confirmation} onChange={e => setConfirmation(e.target.value)} />
      <Button disabled={save.isPending || confirmation !== targetConfirmation || (mode === 'pilot' && !pilot)} onClick={() => save.mutate()}>Betriebsmodus verbindlich bestätigen</Button>
    </DialogContent></Dialog>
  </CardContent></Card>;
}
