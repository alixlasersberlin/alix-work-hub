import { useCallback, useEffect, useRef, useState } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { loadLiveSessions, filterLiveSessions, type LiveSession } from '@/lib/sales/live-sessions';
import { WHATSAPP_SESSION_STATUSES, sessionStatusLabel } from '@/lib/sales/lead-admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageCircle, RefreshCw } from 'lucide-react';

export function LiveSalesSessions() {
  const { allowedTenants, current } = useTenant();
  const { user } = useAuth();
  const [tenant, setTenant] = useState(current?.id || '');
  const [rows, setRows] = useState<LiveSession[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const generation = useRef(0);
  const busy = useRef(false);
  useEffect(() => { setTenant(current?.id || ''); }, [current?.id]);
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
  return <div className="p-4 md:p-6 space-y-6">
    <header className="flex items-center justify-between gap-4"><div><div className="flex gap-2 items-center text-primary"><MessageCircle className="h-5 w-5" /><span>ALIXSMART</span></div><h1 className="text-2xl font-semibold mt-2">WhatsApp Sales</h1></div><Button variant="outline" size="icon" aria-label="Sessions aktualisieren" disabled={!tenant || loading} onClick={() => void reload()}><RefreshCw className="h-4 w-4" /></Button></header>
    <div className="flex flex-wrap gap-3 items-center">
      <Select value={tenant || 'none'} onValueChange={value => setTenant(value === 'none' ? '' : value)}><SelectTrigger className="w-full sm:w-72" aria-label="Firma für WhatsApp"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Firma auswählen</SelectItem>{allowedTenants.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select>
      <Select value={status || 'all'} onValueChange={value => setStatus(value === 'all' ? '' : value)}><SelectTrigger className="w-full sm:w-60" aria-label="Gesprächsstatus"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Alle Gesprächsstatus</SelectItem>{WHATSAPP_SESSION_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}{[...new Set(rows.map(r => r.status).filter((s): s is string => !!s && !WHATSAPP_SESSION_STATUSES.some(k => k.value === s)))].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
      <Input className="w-full sm:w-72" aria-label="Sessions durchsuchen" placeholder="Session oder Kontakt-ID" value={query} onChange={e => setQuery(e.target.value)} /><Badge variant="outline">{visible.length} Sessions{cursor ? ' · weitere verfügbar' : ''}</Badge>
    </div>
    {error && <div role="alert" className="border border-destructive p-4 text-destructive">{error}</div>}
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b border-border text-muted-foreground"><tr>{['Session', 'Kontakt', 'Gesprächsstatus', 'Zuweisung in ALIXSMART', 'Letzte Nachricht'].map(label => <th key={label} className="p-3 text-left font-medium">{label}</th>)}</tr></thead><tbody>{visible.map(row => <tr key={row.id} className="border-b border-border"><td className="p-3 font-mono text-xs">{row.id}</td><td className="p-3 font-mono text-xs">{row.contact_id}</td><td className="p-3"><Badge variant="outline">{sessionStatusLabel(row.status)}</Badge></td><td className="p-3 break-all text-xs">{row.assigned_user_id || 'Nicht zugewiesen'}</td><td className="p-3 whitespace-nowrap">{row.last_message_at ? new Date(row.last_message_at).toLocaleString('de-DE') : '—'}</td></tr>)}</tbody></table></div>
    {!tenant && <p className="py-8 text-muted-foreground">Keine Firma ausgewählt.</p>}
    {tenant && !loading && !error && !rows.length && <p className="py-8 text-muted-foreground">Keine freigegebenen Sessions vorhanden.</p>}
    {loading && <p className="text-sm text-muted-foreground">Sessions werden geladen …</p>}
    {cursor && <Button variant="outline" disabled={loading} onClick={() => void reload(cursor)}>Weitere Sessions</Button>}
  </div>;
}