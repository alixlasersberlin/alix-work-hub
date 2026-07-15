import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Ticket, Search, ArrowRight, Loader2, Plus, RefreshCw, Inbox, X, Trash2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { PageHeader } from '@/components/infinity/PageHeader';
import { EmptyState } from '@/components/infinity/EmptyState';
import { SkeletonTable } from '@/components/infinity/Skeleton';
import { StatusBadge as InfinityStatusBadge } from '@/components/infinity/StatusBadge';
import { useFinancePermissions } from '@/hooks/useFinancePermissions';


interface TicketRow {
  id: string;
  external_ticket_id: string | null;
  source_system: string | null;
  customer_name: string | null;
  company_name: string | null;
  order_number: string | null;
  device_name: string | null;
  serial_number: string | null;
  category: string | null;
  auto_category: string | null;
  title: string | null;
  status: string;
  priority: string;
  department: string;
  last_synced_at: string | null;
  created_at: string;
  sla_status: string | null;
  escalation_count: number | null;
  assigned_to: string | null;
  due_at: string | null;
}

function slaBadge(s: string | null) {
  if (!s || s === 'ok') return null;
  const map: Record<string, string> = {
    warning: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    warn_response: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    warn_progress: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    breach: 'bg-red-500/15 text-red-400 border-red-500/30',
  };
  const label = s === 'breach' ? 'SLA ⚠' : 'SLA ⏱';
  return <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded border ${map[s] || ''}`}>{label}</span>;
}

const STATUS_OPTIONS = ['open', 'in-progress', 'wartet_Kunde', 'offen', 'in_bearbeitung', 'wartet_kunde', 'gelöst', 'geschlossen'];
const PRIORITY_OPTIONS = ['niedrig', 'normal', 'hoch', 'kritisch'];
const DEPARTMENT_OPTIONS = ['service', 'technik', 'finance', 'tourenplanung', 'lieferung', 'abholung', 'austausch'];
const CATEGORY_OPTIONS = ['Reklamation', 'Reparatur', 'Wartung', 'Installation', 'Schulung', 'Beratung', 'Ersatzteil', 'Rückgabe', 'Finance', 'Sonstiges'];

function statusColor(s: string) {
  switch (s) {
    case 'open':
    case 'offen': return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    case 'in-progress':
    case 'in_bearbeitung': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'wartet_Kunde':
    case 'wartet_kunde': return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    case 'gelöst': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'geschlossen': return 'bg-muted text-muted-foreground border-border';
    default: return 'bg-muted text-muted-foreground border-border';
  }
}
function priorityColor(p: string) {
  switch (p) {
    case 'kritisch': return 'bg-red-500/15 text-red-400 border-red-500/30';
    case 'hoch': return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
    case 'normal': return 'bg-muted text-muted-foreground border-border';
    case 'niedrig': return 'bg-muted text-muted-foreground border-border';
    default: return 'bg-muted text-muted-foreground border-border';
  }
}

export default function TicketsList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusF, setStatusF] = useState<string>('all');
  const [prioF, setPrioF] = useState<string>('all');
  const [deptF, setDeptF] = useState<string>('all');
  const [sourceF, setSourceF] = useState<string>('all');
  const [catF, setCatF] = useState<string>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [nt, setNt] = useState({
    title: '', description: '', customer_name: '', company_name: '',
    customer_email: '', customer_phone: '', order_number: '',
    device_name: '', serial_number: '',
    priority: 'normal', department: 'service', category: '',
  });

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { isSuperAdmin } = useFinancePermissions();

  async function updateCategory(id: string, category: string | null) {
    const { error } = await supabase.from('tickets').update({ category }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    setRows(prev => prev.map(r => r.id === id ? { ...r, category } : r));
    toast.success('Kategorie aktualisiert');
  }

  async function deleteTicket(id: string) {
    if (!isSuperAdmin) { toast.error('Nur Super Admin darf Tickets löschen'); return; }
    if (!window.confirm('Ticket wirklich unwiderruflich löschen?')) return;
    const { error } = await supabase.from('tickets').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    setRows(prev => prev.filter(r => r.id !== id));
    toast.success('Ticket gelöscht');
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('tickets')
        .select('id, external_ticket_id, source_system, customer_name, company_name, order_number, device_name, serial_number, category, auto_category, title, status, priority, department, last_synced_at, created_at, sla_status, escalation_count, assigned_to, due_at')
        .order('created_at', { ascending: false })
        .limit(500);
      if (!cancelled) {
        if (error) console.error(error);
        setRows((data as TicketRow[]) || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setCreateOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('new');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // URL-basierte Filter (aus Dashboard verlinkt)
  const urlSla = searchParams.get('sla'); // warning | breach
  const urlEscalated = searchParams.get('escalated') === '1';
  const urlMine = searchParams.get('mine') === '1';
  const urlDue = searchParams.get('due'); // today | overdue
  const hasUrlFilters = !!(urlSla || urlEscalated || urlMine || urlDue);

  const clearUrlFilters = () => {
    const next = new URLSearchParams(searchParams);
    ['sla', 'escalated', 'mine', 'due'].forEach(k => next.delete(k));
    setSearchParams(next, { replace: true });
  };
  const removeUrlFilter = (key: string) => {
    const next = new URLSearchParams(searchParams);
    next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
    return rows.filter(r => {
      if (statusF !== 'all' && r.status !== statusF) return false;
      if (prioF !== 'all' && r.priority !== prioF) return false;
      if (deptF !== 'all' && r.department !== deptF) return false;
      if (sourceF !== 'all' && r.source_system !== sourceF) return false;
      if (catF !== 'all') {
        const c = r.category || r.auto_category || '__none__';
        if (catF === '__none__' ? (r.category || r.auto_category) : c !== catF) return false;
      }
      if (urlSla === 'warning' && !(r.sla_status && r.sla_status.startsWith('warn'))) return false;
      if (urlSla === 'breach' && r.sla_status !== 'breach') return false;
      if (urlEscalated && (r.escalation_count || 0) <= 0) return false;
      if (urlMine && (!currentUserId || r.assigned_to !== currentUserId)) return false;
      if (urlDue) {
        if (!r.due_at) return false;
        const t = new Date(r.due_at).getTime();
        if (urlDue === 'today' && !(t >= now - 24*3600_000 && t <= endOfToday.getTime())) return false;
        if (urlDue === 'overdue' && !(t < now)) return false;
      }
      if (!q) return true;
      const hay = [r.customer_name, r.company_name, r.order_number, r.device_name, r.serial_number, r.title, r.external_ticket_id]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, statusF, prioF, deptF, sourceF, catF, urlSla, urlEscalated, urlMine, urlDue, currentUserId]);

  const isClosed = (s: string) => s === 'geschlossen' || s === 'gelöst';
  const openRows = useMemo(() => filtered.filter(r => !isClosed(r.status)), [filtered]);
  const closedRows = useMemo(() => filtered.filter(r => isClosed(r.status)), [filtered]);
  const wartungRows = useMemo(
    () => filtered.filter(r => (r.category || r.auto_category || '').toLowerCase() === 'wartung'),
    [filtered],
  );
  const reklamationRows = useMemo(
    () => filtered.filter(r => (r.category || r.auto_category || '').toLowerCase() === 'reklamation'),
    [filtered],
  );
  const [tab, setTab] = useState<'open' | 'closed' | 'wartung' | 'reklamation'>('open');


  const sources = useMemo(() => Array.from(new Set(rows.map(r => r.source_system).filter(Boolean))) as string[], [rows]);
  const categories = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => {
      const c = (r.category || r.auto_category || '').trim();
      if (c) set.add(c);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'de'));
  }, [rows]);
  const hasUncategorized = useMemo(() => rows.some(r => !r.category && !r.auto_category), [rows]);

  const openCreateDialog = () => {
    setCreateOpen(true);
  };

  const closeCreateDialog = () => {
    if (!creating) setCreateOpen(false);
  };



  async function createTicket() {
    if (!nt.title.trim()) { toast.error('Titel ist erforderlich'); return; }
    setCreating(true);
    const clean = <T extends Record<string, any>>(obj: T) => {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'string') {
          const t = v.trim();
          out[k] = t === '' ? null : t;
        } else {
          out[k] = v;
        }
      }
      return out;
    };
    const payload = {
      ...clean(nt),
      title: nt.title.trim(),
      source_system: 'alixwork',
      status: 'offen',
      customer_visible_status: 'Ticket eingegangen',
      priority: nt.priority || 'normal',
      department: nt.department || 'service',
    };
    const { data, error } = await supabase
      .from('tickets')
      .insert(payload)
      .select('id')
      .single();
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Ticket erstellt');
    setCreateOpen(false);
    setNt({ title: '', description: '', customer_name: '', company_name: '', customer_email: '', customer_phone: '', order_number: '', device_name: '', serial_number: '', priority: 'normal', department: 'service', category: '' });
    if (data?.id) navigate(`/tickets/${data.id}`);
  }

  return (
    <>
      <div className="p-6 lg:p-8 animate-fade-in">
      <PageHeader
        title="Tickets"
        subtitle="Service-, Technik- und Finance-Tickets aus allen Quellen"
        icon={Ticket}
        meta={
          <>
            <InfinityStatusBadge kind={loading ? 'progress' : 'done'} label={loading ? 'Lädt' : `${filtered.length}`} pulse={!loading} />
          </>
        }
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link to="/tickets/sync"><RefreshCw className="w-4 h-4 mr-2" />Synchronisation</Link>
            </Button>
            <Button
              size="sm"
              type="button"
              onClick={openCreateDialog}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold border-0"
            >
              <Plus className="w-4 h-4 mr-1" /> Neues Ticket
            </Button>
          </>
        }
      />




      <div className="rounded-xl border border-border bg-card p-4 mb-4 grid gap-3 md:grid-cols-5">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Suche Kunde, Gerät, Seriennr., Auftragsnr., Titel..." className="pl-9" />
        </div>
        <Select value={statusF} onValueChange={setStatusF}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={prioF} onValueChange={setPrioF}>
          <SelectTrigger><SelectValue placeholder="Priorität" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Prioritäten</SelectItem>
            {PRIORITY_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={deptF} onValueChange={setDeptF}>
          <SelectTrigger><SelectValue placeholder="Abteilung" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Abteilungen</SelectItem>
            {DEPARTMENT_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sourceF} onValueChange={setSourceF}>
          <SelectTrigger><SelectValue placeholder="Quelle" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Quellen</SelectItem>
            {sources.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={catF} onValueChange={setCatF}>
          <SelectTrigger><SelectValue placeholder="Kategorie" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Kategorien</SelectItem>
            {hasUncategorized && <SelectItem value="__none__">Ohne Kategorie</SelectItem>}
            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {hasUrlFilters && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Aktive Filter:</span>
          {urlSla === 'warning' && (
            <button onClick={() => removeUrlFilter('sla')} className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20">
              SLA-Warnung <X className="w-3 h-3" />
            </button>
          )}
          {urlSla === 'breach' && (
            <button onClick={() => removeUrlFilter('sla')} className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20">
              SLA-Verletzung <X className="w-3 h-3" />
            </button>
          )}
          {urlEscalated && (
            <button onClick={() => removeUrlFilter('escalated')} className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-orange-500/40 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20">
              Eskaliert <X className="w-3 h-3" />
            </button>
          )}
          {urlMine && (
            <button onClick={() => removeUrlFilter('mine')} className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20">
              Mir zugewiesen <X className="w-3 h-3" />
            </button>
          )}
          {urlDue === 'today' && (
            <button onClick={() => removeUrlFilter('due')} className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20">
              Fällig heute <X className="w-3 h-3" />
            </button>
          )}
          {urlDue === 'overdue' && (
            <button onClick={() => removeUrlFilter('due')} className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20">
              Überfällig <X className="w-3 h-3" />
            </button>
          )}
          <button onClick={clearUrlFilters} className="ml-1 text-muted-foreground hover:text-foreground underline">Alle löschen</button>
        </div>
      )}



      <Tabs value={tab} onValueChange={(v) => setTab(v as 'open' | 'closed' | 'wartung' | 'reklamation')}>
        <TabsList className="mb-3">
          <TabsTrigger value="open">Offene Tickets ({openRows.length})</TabsTrigger>
          <TabsTrigger value="closed">Geschlossene Tickets ({closedRows.length})</TabsTrigger>
          <TabsTrigger value="wartung">Wartung ({wartungRows.length})</TabsTrigger>
          <TabsTrigger value="reklamation">Reklamation ({reklamationRows.length})</TabsTrigger>
        </TabsList>

        {(['open', 'closed', 'wartung', 'reklamation'] as const).map((key) => {
          const list =
            key === 'open' ? openRows
              : key === 'closed' ? closedRows
              : key === 'wartung' ? wartungRows
              : reklamationRows;
          const emptyTitle =
            key === 'open' ? 'Keine offenen Tickets'
              : key === 'closed' ? 'Keine geschlossenen Tickets'
              : key === 'wartung' ? 'Keine Wartungs-Tickets'
              : 'Keine Reklamations-Tickets';
          return (
            <TabsContent key={key} value={key}>
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                {loading ? (
                  <div className="p-4"><SkeletonTable rows={8} cols={9} /></div>
                ) : list.length === 0 ? (
                  <div className="p-8">
                    <EmptyState
                      compact
                      icon={Inbox}
                      title={emptyTitle}
                      description="Passe die Filter an oder erstelle ein neues Ticket."
                      action={key === 'open' ? { label: 'Neues Ticket', icon: Plus, onClick: openCreateDialog } : undefined}
                    />
                  </div>

                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kategorie</TableHead>
                        <TableHead>Ticket</TableHead>
                        <TableHead>Kunde</TableHead>
                        <TableHead>Gerät</TableHead>
                        <TableHead>Seriennr.</TableHead>
                        <TableHead>Abteilung</TableHead>
                        <TableHead>Priorität</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Letzter Sync</TableHead>
                        <TableHead className="text-right">Aktion</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {list.map(r => (
                        <TableRow
                          key={r.id}
                          onClick={() => navigate(`/tickets/${r.id}`)}
                          className="cursor-pointer hover:bg-muted/40"
                        >
                          <TableCell className="text-sm" onClick={(e) => e.stopPropagation()}>
                            <div className="relative min-w-40">
                              <select
                                value={r.category || ''}
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => updateCategory(r.id, e.target.value || null)}
                                className="h-8 w-full rounded-md border border-input bg-background px-2 pr-7 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
                                title="Kategorie zuweisen"
                              >
                                <option value="">{r.auto_category ? `Auto: ${r.auto_category}` : 'Kategorie wählen'}</option>
                                {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-foreground">
                              {r.title || r.external_ticket_id || r.id.slice(0, 8)}
                              {slaBadge(r.sla_status)}
                              {(r.escalation_count || 0) > 0 && (
                                <span className="ml-1 text-[10px] text-red-400">·{r.escalation_count}×esk.</span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">{r.external_ticket_id || r.source_system}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{r.customer_name || '—'}</div>
                            <div className="text-xs text-muted-foreground">{r.company_name || ''}</div>
                          </TableCell>
                          <TableCell className="text-sm">{r.device_name || '—'}</TableCell>
                          <TableCell className="text-sm font-mono">{r.serial_number || '—'}</TableCell>
                          <TableCell><Badge variant="outline">{r.department}</Badge></TableCell>
                          <TableCell><Badge variant="outline" className={priorityColor(r.priority)}>{r.priority}</Badge></TableCell>
                          <TableCell><Badge variant="outline" className={statusColor(r.status)}>{r.status}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {r.last_synced_at ? new Date(r.last_synced_at).toLocaleString('de-DE') : '—'}
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="inline-flex items-center gap-1">
                              <Button size="sm" variant="outline" asChild>
                                <Link to={`/tickets/${r.id}`}>Details <ArrowRight className="w-3 h-3 ml-1" /></Link>
                              </Button>
                              {isSuperAdmin && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-400 border-red-500/40 hover:bg-red-500/10"
                                  onClick={() => deleteTicket(r.id)}
                                  title="Ticket löschen (Super Admin)"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </TabsContent>
          );
        })}
      </Tabs>

      {createOpen && (
        <div
          className="fixed inset-0 z-[9000] flex items-center justify-center overflow-y-auto bg-background/85 p-4 backdrop-blur-sm sm:p-6"
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-ticket-title"
            aria-describedby="create-ticket-description"
            className="relative my-auto grid w-[calc(100dvw-2rem)] max-w-2xl max-h-[calc(100dvh-2rem)] gap-4 overflow-y-auto rounded-md border bg-background p-6 shadow-lg"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Schließen"
              onClick={closeCreateDialog}
              disabled={creating}
              className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex flex-col space-y-1.5 text-center sm:text-left">
              <h2 id="create-ticket-title" className="text-lg font-semibold leading-none tracking-tight">
                Neues Ticket erstellen
              </h2>
              <p id="create-ticket-description" className="sr-only">
                Formular zum manuellen Erfassen eines neuen Service-, Technik- oder Finance-Tickets.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label className="text-xs">Kategorie</Label>
              <select
                value={nt.category}
                onChange={e => setNt({ ...nt, category: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="">— keine —</option>
                {CATEGORY_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Titel *</Label>
              <Input value={nt.title} onChange={e => setNt({ ...nt, title: e.target.value })} placeholder="Kurze Zusammenfassung" />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Beschreibung</Label>
              <Textarea rows={4} value={nt.description} onChange={e => setNt({ ...nt, description: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Kunde</Label>
              <Input value={nt.customer_name} onChange={e => setNt({ ...nt, customer_name: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Firma</Label>
              <Input value={nt.company_name} onChange={e => setNt({ ...nt, company_name: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">E-Mail</Label>
              <Input type="email" value={nt.customer_email} onChange={e => setNt({ ...nt, customer_email: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Telefon</Label>
              <Input value={nt.customer_phone} onChange={e => setNt({ ...nt, customer_phone: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Auftragsnr.</Label>
              <Input value={nt.order_number} onChange={e => setNt({ ...nt, order_number: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Gerät</Label>
              <Input value={nt.device_name} onChange={e => setNt({ ...nt, device_name: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Seriennummer</Label>
              <Input value={nt.serial_number} onChange={e => setNt({ ...nt, serial_number: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Abteilung</Label>
              <select
                value={nt.department}
                onChange={e => setNt({ ...nt, department: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                {DEPARTMENT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Priorität</Label>
              <select
                value={nt.priority}
                onChange={e => setNt({ ...nt, priority: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                {PRIORITY_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={closeCreateDialog} disabled={creating}>Abbrechen</Button>
            <Button onClick={createTicket} disabled={creating}>
              {creating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
              Ticket erstellen
            </Button>
            </div>
          </section>
        </div>
      )}

    </div>
    </>
  );
}
