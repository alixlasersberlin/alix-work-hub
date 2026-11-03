import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { isSalesPortalPath } from '@/lib/sales/portal-navigation';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/contexts/TenantContext';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { canReassignLeads, leadInWorkspace, isWhatsAppLead, matchesSessionStatus, sessionStatusLabel, WHATSAPP_SESSION_STATUSES, loadLeadUsers, matchesLeadUser, type LeadUser } from '@/lib/sales/lead-admin';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, ArrowRight, RefreshCw, AlertTriangle, Archive, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { loadMyLeads, loadLeadStats, leadTitle, followupState, isUnworked48h, MY_LEAD_STATUSES, type MyLead } from '@/lib/sales/my-leads';
import { LiveSalesSessions } from '@/components/sales/LiveSalesSessions';

export default function MyLeads() {
  const { user, isAdmin, roles } = useAuth();
  const superAdmin = canReassignLeads(roles);
  const { current } = useTenant();
  const location = useLocation();
  const leadBase = isSalesPortalPath(location.pathname) ? '/meine-leads/akte' : '/vertrieb/meine-leads';
  const [leads, setLeads] = useState<MyLead[]>([]);
  const [stats, setStats] = useState({ open_offers: 0, order_value: 0, orders: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statsError, setStatsError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [sessionStatus, setSessionStatus] = useState('');
  const [people, setPeople] = useState<LeadUser[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [userError, setUserError] = useState('');
  useEffect(() => {
    let active = true;
    void loadLeadUsers().then(rows => { if (active) { setPeople(rows); setUserError(''); } }).catch(e => { if (active && superAdmin) setUserError(e.message); });
    return () => { active = false; };
  }, [superAdmin]);
  const [priority, setPriority] = useState('');
  const [product, setProduct] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [all, setAll] = useState(superAdmin);
  const [params] = useSearchParams();
  const view = params.get('ansicht');
  const showSessions = superAdmin && view === 'whatsapp';
  useEffect(() => { setAll(isAdmin && (superAdmin || view === 'gesamt')); }, [view, isAdmin, superAdmin]);
  const reload = useCallback(async () => {
    await Promise.all([
      loadMyLeads().then(rows => { setLeads(rows); setError(''); })
        .catch(e => { setError(e instanceof Error ? e.message : 'Leads konnten nicht geladen werden.'); })
        .finally(() => setLoading(false)),
      loadLeadStats(all && isAdmin, all && isAdmin ? null : current?.id || null)
        .then(metrics => { setStats(metrics); setStatsError(''); })
        .catch(() => { setStatsError('Angebots- und Auftragskennzahlen konnten nicht aktualisiert werden.'); }),
    ]);
  }, [all, isAdmin, current?.id]);
  const [showArchived, setShowArchived] = useState(false);
  const adminLead = async (id: string, action: 'archive' | 'restore' | 'delete') => {
    if (action === 'delete' && !confirm('Lead endgültig löschen? Verlauf und Wiedervorlagen werden mitgelöscht.')) return;
    const { error: e } = action === 'delete' ? await supabase.rpc('ml_admin_delete_lead' as any, { _lead_id: id }) : await supabase.rpc('ml_admin_archive_lead' as any, { _lead_id: id, _archived: action === 'archive' });
    if (e) { toast.error(e.message); return; }
    toast.success(action === 'delete' ? 'Lead gelöscht' : action === 'archive' ? 'Lead archiviert' : 'Lead wiederhergestellt');
    void reload();
  };
  useEffect(() => { if (view !== 'whatsapp') void reload(); }, [reload, view]);
  useRealtimeRefresh(['sales_leads', 'sales_followups', 'sales_lead_history', 'offers', 'orders'], reload, { debounceMs: 1000 });
  useEffect(() => { if (view === 'whatsapp') return; const id = setInterval(() => { if (!document.hidden) void reload(); }, 30000); return () => clearInterval(id); }, [reload, view]);
  const scoped = useMemo(() => leads.filter(l => (showArchived ? !!(l as any).archived : !(l as any).archived) && leadInWorkspace(l, user?.id, isAdmin, all, current?.id) && (!superAdmin || matchesLeadUser(l, selectedUser))), [leads, all, isAdmin, user?.id, current, superAdmin, selectedUser, showArchived]);
  const visible = scoped.filter(l => (view !== 'whatsapp' || isWhatsAppLead(l)) && (!showSessions || matchesSessionStatus(l, sessionStatus)) && (view !== 'kontakt' || ['Neu', 'Kontaktaufnahme läuft'].includes(l.lead_status)) && (view !== 'neu' || (!l.workspace?.last_activity_at && !['Gewonnen', 'Verloren', 'Archiviert'].includes(l.lead_status))) && (view !== 'wiedervorlagen' || (l.followups || []).some(f => followupState(f) !== 'done')) && (!status || l.lead_status === status) && (!priority || (l.workspace?.priority || 'Normal') === priority) && (!product || (l.requested_products || '').toLowerCase().includes(product.toLowerCase())) && (!from || l.created_at.slice(0, 10) >= from) && (!to || l.created_at.slice(0, 10) <= to) && [leadTitle(l), l.email, l.phone, l.lead_number].join(' ').toLowerCase().includes(query.toLowerCase()));
  const tasks = scoped.flatMap(l => l.followups || []);
  const metrics = [
    ['Meine Leads', scoped.length], ['Neu / unbearbeitet', scoped.filter(l => !l.workspace?.last_activity_at && !['Gewonnen', 'Verloren', 'Archiviert'].includes(l.lead_status)).length],
    ['Heute kontaktieren', tasks.filter(f => f.due_at && new Date(f.due_at).toDateString() === new Date().toDateString() && followupState(f) !== 'done').length], ['Überfällige Wiedervorlagen', tasks.filter(f => followupState(f) === 'overdue').length],
    ['Offene Angebote', stats.open_offers], ['Gewonnen', scoped.filter(l => l.lead_status === 'Gewonnen').length], ['Verloren', scoped.filter(l => l.lead_status === 'Verloren').length], ['Auftragswert', new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(stats.order_value)],
  ];
  if (view === 'whatsapp') return <LiveSalesSessions />;
  return <div className="p-4 md:p-6 space-y-6">
    <header className="flex justify-between items-center gap-3 flex-wrap"><div><div className="flex items-center gap-2 text-primary"><Users className="h-5 w-5" /><span className="text-sm">Vertrieb</span></div><h1 className="text-2xl font-semibold mt-2">Meine Leads</h1></div><div className="flex gap-2">{superAdmin && <Button variant={showArchived ? 'default' : 'outline'} onClick={() => setShowArchived(v => !v)}><Archive className="h-4 w-4 mr-1.5" />{showArchived ? 'Archiv' : 'Archiv anzeigen'}</Button>}{isAdmin && <Button variant={all ? 'default' : 'outline'} onClick={() => setAll(!all)}>{all ? 'Alle Leads' : 'Meine Leads'}</Button>}<Button variant="outline" size="icon" aria-label="Aktualisieren" onClick={() => void reload()}><RefreshCw className="h-4 w-4" /></Button></div></header>
    {error && <div role="alert" className="border border-destructive bg-destructive/10 p-4 text-destructive">{error}<Button variant="outline" className="ml-3" onClick={() => void reload()}>Erneut laden</Button></div>}
    {statsError && <p role="status" className="text-sm text-destructive">{statsError}</p>}
    <section className="grid grid-cols-2 lg:grid-cols-4 border-y border-border">{metrics.map(([label, value]) => <div key={label} className="p-4 border-b border-border"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold mt-2">{loading || (statsError && ['Offene Angebote', 'Auftragswert'].includes(String(label))) ? '—' : value}</p></div>)}</section>
    {superAdmin && <div className="space-y-2"><Select value={selectedUser || 'all'} onValueChange={value => { setSelectedUser(value === 'all' ? '' : value); setAll(true); }}><SelectTrigger className="w-full sm:w-80" aria-label="Benutzer auswählen"><SelectValue placeholder="Alle Benutzer" /></SelectTrigger><SelectContent><SelectItem value="all">Alle Benutzer</SelectItem><SelectItem value="unassigned">Nicht zugewiesen</SelectItem>{people.map(person => <SelectItem key={person.id} value={person.id}>{person.full_name || person.id}{person.is_active === false ? ' · Inaktiv' : ''}</SelectItem>)}</SelectContent></Select>{userError && <p role="alert" className="text-sm text-destructive">{userError}</p>}</div>}
    {showSessions && <div className="flex items-center gap-3 flex-wrap"><Select value={sessionStatus || 'all'} onValueChange={value => setSessionStatus(value === 'all' ? '' : value)}><SelectTrigger className="w-full sm:w-72" aria-label="Gesprächsstatus"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Alle Sessions · alle Status</SelectItem>{WHATSAPP_SESSION_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}{[...new Set(scoped.map(l => l.whatsapp_session?.status).filter((s): s is string => !!s && !WHATSAPP_SESSION_STATUSES.some(known => known.value === s)))].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}<SelectItem value="unknown">Status nicht übermittelt</SelectItem></SelectContent></Select><Badge variant="outline">{visible.length} Sessions</Badge></div>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Input aria-label="Leads durchsuchen" placeholder="Name, E-Mail, Telefonnummer …" value={query} onChange={e => setQuery(e.target.value)} /><select aria-label="Leadstatus" className="h-10 rounded-md border border-input bg-background px-3" value={status} onChange={e => setStatus(e.target.value)}><option value="">Alle Status</option>{[...new Set([...MY_LEAD_STATUSES, ...leads.map(l => l.lead_status)])].map(s => <option key={s}>{s}</option>)}</select><select aria-label="Priorität" className="h-10 rounded-md border border-input bg-background px-3" value={priority} onChange={e => setPriority(e.target.value)}><option value="">Alle Prioritäten</option>{['Niedrig', 'Normal', 'Hoch', 'Dringend'].map(s => <option key={s}>{s}</option>)}</select><Input aria-label="Produktfilter" placeholder="Produkt" value={product} onChange={e => setProduct(e.target.value)} /><label className="text-xs text-muted-foreground">Eingang ab<Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label className="text-xs text-muted-foreground">Eingang bis<Input type="date" value={to} onChange={e => setTo(e.target.value)} /></label></div>
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b border-border text-muted-foreground"><tr>{['Eingang', 'Lead', 'Mitarbeiter', 'Produkt', 'Leadstatus', ...(showSessions ? ['Gesprächsstatus'] : []), 'Priorität', 'Nächster Kontakt', ''].map((s, i) => <th className="py-3 px-3 text-left font-medium" key={i}>{s}</th>)}</tr></thead><tbody>{visible.map(l => { const next = (l.followups || []).filter(f => followupState(f) !== 'done' && f.due_at).sort((a, b) => (a.due_at || '').localeCompare(b.due_at || ''))[0]; return <tr key={l.id} className="border-b border-border hover:bg-muted/30"><td className="p-3 whitespace-nowrap">{new Date(l.created_at).toLocaleDateString('de-DE')}</td><td className="p-3"><Link className="font-medium text-primary" to={`${leadBase}/${l.id}`}>{leadTitle(l)}</Link><p className="text-xs text-muted-foreground mt-1">{l.lead_number} · {l.email || l.phone || '—'}</p>{!l.tenant_id && <span className="text-xs text-destructive">Mandant ungeklärt</span>}{isUnworked48h(l) && <span className="flex gap-1 text-xs text-destructive mt-1"><AlertTriangle className="h-3 w-3" />48 Stunden unbearbeitet</span>}</td><td className="p-3 whitespace-nowrap">{l.assigned_user ? (people.find(u => u.id === l.assigned_user)?.full_name || 'Zugewiesen') : <span className="text-muted-foreground">Nicht zugewiesen</span>}</td><td className="p-3 max-w-56 whitespace-pre-wrap">{l.requested_products || '—'}</td><td className="p-3"><Badge variant="outline">{l.lead_status}</Badge></td>{showSessions && <td className="p-3"><Badge variant="outline">{sessionStatusLabel(l.whatsapp_session?.status)}</Badge></td>}<td className="p-3">{l.workspace?.priority || 'Normal'}</td><td className="p-3">{next?.due_at ? new Date(next.due_at).toLocaleString('de-DE') : '—'}</td><td className="whitespace-nowrap">{superAdmin && <><Button variant="ghost" size="icon" title={(l as any).archived ? 'Wiederherstellen' : 'Archivieren'} aria-label="Lead archivieren" onClick={() => void adminLead(l.id, (l as any).archived ? 'restore' : 'archive')}><Archive className="h-4 w-4" /></Button><Button variant="ghost" size="icon" title="Löschen" aria-label="Lead löschen" className="text-destructive" onClick={() => void adminLead(l.id, 'delete')}><Trash2 className="h-4 w-4" /></Button></>}<Button asChild variant="ghost" size="icon"><Link aria-label={`${leadTitle(l)} öffnen`} to={`${leadBase}/${l.id}`}><ArrowRight className="h-4 w-4" /></Link></Button></td></tr>; })}</tbody></table></div>
    {!loading && !visible.length && <p className="py-12 text-center text-muted-foreground">Keine zugänglichen Leads gefunden.</p>}
  </div>;
}