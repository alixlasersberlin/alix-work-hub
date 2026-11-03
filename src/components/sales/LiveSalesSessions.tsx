import { useCallback, useEffect, useRef, useState } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { loadLiveSessions, filterLiveSessions, defaultWhatsAppTenant, type LiveSession } from '@/lib/sales/live-sessions';
import { WHATSAPP_SESSION_STATUSES, sessionStatusLabel } from '@/lib/sales/lead-admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageCircle, RefreshCw, Search, UserRound, Clock } from 'lucide-react';

export function LiveSalesSessions() {
  const { allowedTenants, current } = useTenant();
  const { user } = useAuth();
  const [tenant, setTenant] = useState('');
  const initializedFor = useRef<string | null>(null);
  const [rows, setRows] = useState<LiveSession[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const generation = useRef(0);
  const busy = useRef(false);
  useEffect(() => {
    if (!user) { initializedFor.current = null; setTenant(''); return; }
    if (!allowedTenants.length || initializedFor.current === user.id) return;
    initializedFor.current = user.id;
    setTenant(defaultWhatsAppTenant(allowedTenants, current?.id));
  }, [allowedTenants, current?.id, user?.id]);
  useEffect(() => { generation.current++; setRows([]); setCursor(null); setError(''); busy.current = false; }, [tenant, user?.id]);
  const reload = useCallback(async (before?: string) => {
    if (!tenant || !user || busy.current) return;
    busy.current = true; setLoading(true);
    const ticket = generation.current;
    try {
      const page = await loadLiveSessions(tenant, before);
      if (ticket !== generation.current) return;
      setRows(previous => before ? [...new Map([...previous, ...page.conversations].map(row => [row.id, row])).values()] : page.conversations);
      setCursor(page.next_cursor); setError('');
    } catch (e) { if (ticket === generation.current) { setError(e instanceof Error ? e.message : 'Chatübersicht nicht erreichbar.'); setRows([]); setCursor(null); } }
    finally { if (ticket === generation.current) { busy.current = false; setLoading(false); } }
  }, [tenant, user?.id]);
  useEffect(() => { void reload(); }, [reload]);
  const refresh = useCallback(() => { void reload(); }, [reload]);
  useRealtimeRefresh(['sales_lead_history', 'sales_leads'], refresh, { debounceMs: 1000 });
  useEffect(() => {
    const onFocus = () => { if (!document.hidden) void reload(); };
    const timer = window.setInterval(onFocus, 15000);
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(timer); window.removeEventListener('focus', onFocus); generation.current++; };
  }, [reload]);
  const visible = filterLiveSessions(rows, status, query);
  const statuses = [...new Set(rows.map(row => row.status).filter((value): value is string => !!value))];
  return <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
    <header className="flex items-center justify-between gap-4"><div className="flex items-center gap-4 min-w-0"><div className="h-12 w-12 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><MessageCircle className="h-6 w-6" /></div><div><h1 className="text-2xl font-semibold">Sales – WhatsApp</h1><p className="text-muted-foreground mt-1">{rows.length} Konversationen{cursor ? ' · weitere verfügbar' : ''}</p></div></div><Button variant="outline" size="icon" aria-label="Sessions aktualisieren" title="Aktualisieren" disabled={!tenant || loading} onClick={() => void reload()}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin motion-reduce:animate-none' : ''}`} /></Button></header>
    <div className="flex flex-wrap gap-3 items-center">
      <Select value={tenant || 'none'} onValueChange={value => setTenant(value === 'none' ? '' : value)}><SelectTrigger className="w-full sm:w-72" aria-label="Firma für WhatsApp"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Firma auswählen</SelectItem>{allowedTenants.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select>
      <Select value={status || 'all'} onValueChange={value => setStatus(value === 'all' ? '' : value)}><SelectTrigger className="w-full sm:w-60" aria-label="Gesprächsstatus"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Alle Gesprächsstatus</SelectItem>{WHATSAPP_SESSION_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}{[...new Set(rows.map(r => r.status).filter((s): s is string => !!s && !WHATSAPP_SESSION_STATUSES.some(k => k.value === s)))].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
    </div>
    <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-10 h-10" aria-label="Sessions durchsuchen" placeholder="Session oder Kontakt-ID suchen" value={query} onChange={e => setQuery(e.target.value)} /></div>
    <Tabs value={status || 'all'} onValueChange={value => setStatus(value === 'all' ? '' : value)}><TabsList className="h-auto flex flex-wrap justify-start gap-1 w-full p-2"><TabsTrigger value="all">Alle ({rows.length})</TabsTrigger>{statuses.map(value => <TabsTrigger key={value} value={value}>{sessionStatusLabel(value)} ({rows.filter(row => row.status === value).length})</TabsTrigger>)}</TabsList></Tabs>
    {error && <div role="alert" className="border border-destructive p-4 text-destructive">{error}</div>}
    <ul className="divide-y divide-border border-y border-border" aria-label="WhatsApp-Konversationen">{visible.map(row => <li key={row.id} className="flex gap-3 sm:gap-4 py-5 min-w-0">
      <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0"><UserRound className="h-6 w-6" /></div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-start justify-between gap-3 flex-wrap"><h2 className="font-semibold text-lg break-all">Kontakt {row.contact_id.slice(0, 8)}</h2><span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{row.last_message_at ? new Date(row.last_message_at).toLocaleString('de-DE') : 'Zeitpunkt nicht übermittelt'}</span></div>
        <p className="text-sm text-muted-foreground">Name und Nachrichtenvorschau nicht übermittelt</p>
        <div className="flex flex-wrap gap-2"><Badge variant="outline">{sessionStatusLabel(row.status)}</Badge>{row.triage_state && <Badge variant="secondary">{row.triage_state}</Badge>}</div>
        <p className="text-xs text-muted-foreground flex items-start gap-1.5 break-all"><UserRound className="h-3.5 w-3.5 shrink-0" />{row.assigned_user_id ? `ALIXSMART-Zuweisung: ${row.assigned_user_id}` : 'Nicht zugewiesen'}</p>
        <details className="text-xs text-muted-foreground"><summary className="cursor-pointer w-fit">Kennungen</summary><div className="pt-2 space-y-1 break-all"><p>Kontakt: {row.contact_id}</p><p>Session: {row.id}</p></div></details>
      </div>
    </li>)}</ul>
    {!tenant && <p className="py-8 text-muted-foreground">Keine Firma ausgewählt.</p>}
    {tenant && !loading && !error && !rows.length && <p className="py-8 text-muted-foreground">Keine freigegebenen Sessions vorhanden.</p>}
    {rows.length > 0 && !visible.length && <p className="py-8 text-muted-foreground">Keine Konversationen für diese Auswahl.</p>}
    {loading && <p className="text-sm text-muted-foreground">Sessions werden geladen …</p>}
    {cursor && <Button variant="outline" disabled={loading} onClick={() => void reload(cursor)}>Weitere Sessions</Button>}
  </div>;
}