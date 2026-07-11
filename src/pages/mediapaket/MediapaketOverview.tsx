import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Loader2, Package as PackageIcon, Search, LayoutGrid, List as ListIcon, AlertTriangle, CalendarClock, ExternalLink, User, Download, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Nicht begonnen',
  in_progress: 'In Bearbeitung',
  question_required: 'Rückfrage nötig',
  customer_correction: 'Korrektur beim Kunden',
  submitted: 'Eingereicht',
  in_review: 'In Prüfung',
  approval_pending: 'Freigabe ausstehend',
  in_production: 'In Produktion',
  completed: 'Abgeschlossen',
};

const STATUS_ORDER = ['not_started', 'in_progress', 'question_required', 'customer_correction', 'submitted', 'in_review', 'approval_pending', 'in_production', 'completed'];

const STATUS_TONE: Record<string, string> = {
  not_started: 'border-muted-foreground/30 text-muted-foreground',
  in_progress: 'border-sky-500/40 text-sky-400',
  question_required: 'border-amber-500/40 text-amber-400',
  customer_correction: 'border-orange-500/40 text-orange-400',
  submitted: 'border-emerald-500/40 text-emerald-400',
  in_review: 'border-violet-500/40 text-violet-400',
  approval_pending: 'border-yellow-500/40 text-yellow-400',
  in_production: 'border-blue-500/40 text-blue-400',
  completed: 'border-green-500/40 text-green-400',
};

interface MpRow {
  id: string;
  order_id: string | null;
  customer_id: string | null;
  status: string;
  progress_percent: number | null;
  assigned_user_id: string | null;
  due_date: string | null;
  studio_name: string | null;
  updated_at: string;
  submitted_at: string | null;
  _customer_name?: string;
  _order_number?: string;
  _assignee_name?: string;
  _unread_count?: number;
}

export default function MediapaketOverview() {
  const [rows, setRows] = useState<MpRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('__all__');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('__all__');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [staffList, setStaffList] = useState<Array<{ id: string; label: string }>>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('user_profiles').select('id, full_name, email, is_active').eq('is_active', true).order('full_name');
      setStaffList((data || []).map((p: any) => ({ id: p.id, label: p.full_name || p.email || 'Unbenannt' })));
    })();
  }, []);

  const toggleOne = (id: string) => setSelected(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const toggleAll = (ids: string[], checked: boolean) => setSelected(prev => {
    const n = new Set(prev);
    ids.forEach(id => checked ? n.add(id) : n.delete(id));
    return n;
  });

  const bulkUpdate = async (patch: Record<string, any>, label: string) => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    const { error } = await (supabase.from('media_packages') as any).update(patch).in('id', Array.from(selected));
    setBulkBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${selected.size} Pakete: ${label}`);
    setSelected(new Set());
    load();
  };

  const exportCsv = (list: MpRow[]) => {
    if (list.length === 0) { toast.info('Keine Zeilen zum Exportieren'); return; }
    const header = ['Auftrag', 'Kunde', 'Studio', 'Status', 'Fortschritt %', 'Frist', 'Zuständig', 'Ungelesen', 'Aktualisiert'];
    const esc = (v: any) => {
      const s = v == null ? '' : String(v);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header.join(';')];
    list.forEach(r => {
      lines.push([
        r._order_number || '',
        r._customer_name || '',
        r.studio_name || '',
        STATUS_LABEL[r.status] || r.status,
        r.progress_percent ?? 0,
        r.due_date || '',
        r._assignee_name || '',
        r._unread_count ?? 0,
        r.updated_at,
      ].map(esc).join(';'));
    });
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `mediapakete_${format(new Date(), 'yyyy-MM-dd_HHmm')}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast.success(`${list.length} Zeilen exportiert`);
  };

  const load = async () => {
    setLoading(true);
    const { data: mps } = await supabase
      .from('media_packages')
      .select('id, order_id, customer_id, status, progress_percent, assigned_user_id, due_date, studio_name, updated_at, submitted_at')
      .order('updated_at', { ascending: false })
      .limit(500);
    const list = (mps || []) as MpRow[];

    const cids = Array.from(new Set(list.map(r => r.customer_id).filter(Boolean))) as string[];
    const oids = Array.from(new Set(list.map(r => r.order_id).filter(Boolean))) as string[];
    const uids = Array.from(new Set(list.map(r => r.assigned_user_id).filter(Boolean))) as string[];
    const mpIds = list.map(r => r.id);

    const [custs, ords, profs, comments] = await Promise.all([
      cids.length ? supabase.from('customers').select('id, company_name, first_name, last_name').in('id', cids) : Promise.resolve({ data: [] as any[] }),
      oids.length ? supabase.from('orders').select('id, order_number').in('id', oids) : Promise.resolve({ data: [] as any[] }),
      uids.length ? supabase.from('user_profiles').select('id, full_name, email').in('id', uids) : Promise.resolve({ data: [] as any[] }),
      mpIds.length ? supabase
        .from('media_package_comments')
        .select('media_package_id')
        .in('media_package_id', mpIds)
        .eq('author_type', 'customer')
        .eq('recipient_type', 'staff')
        .eq('internal_only', false)
        .is('read_at', null) : Promise.resolve({ data: [] as any[] }),
    ]);

    const custMap: Record<string, string> = {};
    (custs.data || []).forEach((c: any) => {
      custMap[c.id] = c.company_name || [c.first_name, c.last_name].filter(Boolean).join(' ') || '—';
    });
    const ordMap: Record<string, string> = {};
    (ords.data || []).forEach((o: any) => { ordMap[o.id] = o.order_number || o.id.slice(0, 8); });
    const profMap: Record<string, string> = {};
    (profs.data || []).forEach((p: any) => { profMap[p.id] = p.full_name || p.email || 'Mitarbeiter'; });
    const unreadMap: Record<string, number> = {};
    (comments.data || []).forEach((c: any) => { unreadMap[c.media_package_id] = (unreadMap[c.media_package_id] || 0) + 1; });

    setRows(list.map(r => ({
      ...r,
      _customer_name: r.customer_id ? custMap[r.customer_id] : undefined,
      _order_number: r.order_id ? ordMap[r.order_id] : undefined,
      _assignee_name: r.assigned_user_id ? profMap[r.assigned_user_id] : undefined,
      _unread_count: unreadMap[r.id] || 0,
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const assigneeOptions = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach(r => { if (r.assigned_user_id && r._assignee_name) map.set(r.assigned_user_id, r._assignee_name); });
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [rows]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter(r => {
      if (statusFilter !== '__all__' && r.status !== statusFilter) return false;
      if (assigneeFilter !== '__all__') {
        if (assigneeFilter === '__unassigned__' && r.assigned_user_id) return false;
        if (assigneeFilter !== '__unassigned__' && r.assigned_user_id !== assigneeFilter) return false;
      }
      if (overdueOnly) {
        if (!r.due_date || r.status === 'completed' || new Date(r.due_date) >= new Date()) return false;
      }
      if (!term) return true;
      const hay = [r.studio_name, r._customer_name, r._order_number, r._assignee_name].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(term);
    });
  }, [rows, q, statusFilter, assigneeFilter, overdueOnly]);

  const grouped = useMemo(() => {
    const g: Record<string, MpRow[]> = {};
    STATUS_ORDER.forEach(s => (g[s] = []));
    filtered.forEach(r => { (g[r.status] ||= []).push(r); });
    return g;
  }, [filtered]);

  const stats = useMemo(() => ({
    total: rows.length,
    overdue: rows.filter(r => r.due_date && r.status !== 'completed' && new Date(r.due_date) < new Date()).length,
    unread: rows.reduce((sum, r) => sum + (r._unread_count || 0), 0),
    unassigned: rows.filter(r => !r.assigned_user_id).length,
  }), [rows]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <PackageIcon className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-semibold text-foreground">Mediapaket-Übersicht</h1>
          <Badge variant="outline">{filtered.length} / {rows.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            <Button variant={view === 'list' ? 'default' : 'ghost'} size="sm" className="rounded-none" onClick={() => setView('list')}>
              <ListIcon className="w-4 h-4 mr-1" /> Liste
            </Button>
            <Button variant={view === 'kanban' ? 'default' : 'ghost'} size="sm" className="rounded-none" onClick={() => setView('kanban')}>
              <LayoutGrid className="w-4 h-4 mr-1" /> Kanban
            </Button>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Gesamt" value={stats.total} icon={<PackageIcon className="w-4 h-4 text-muted-foreground" />} />
        <Kpi label="Überfällig" value={stats.overdue} tone={stats.overdue > 0 ? 'red' : undefined} icon={<AlertTriangle className={cn('w-4 h-4', stats.overdue > 0 ? 'text-red-500' : 'text-muted-foreground')} />} />
        <Kpi label="Ungelesene Antworten" value={stats.unread} tone={stats.unread > 0 ? 'amber' : undefined} icon={<CalendarClock className={cn('w-4 h-4', stats.unread > 0 ? 'text-amber-500' : 'text-muted-foreground')} />} />
        <Kpi label="Nicht zugewiesen" value={stats.unassigned} tone={stats.unassigned > 0 ? 'sky' : undefined} icon={<User className={cn('w-4 h-4', stats.unassigned > 0 ? 'text-sky-400' : 'text-muted-foreground')} />} />
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-border bg-card p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Kunde, Studio, Auftrag…" className="pl-8 h-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px] h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Alle Status</SelectItem>
            {STATUS_ORDER.map(s => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
          <SelectTrigger className="w-[200px] h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Alle Zuständigen</SelectItem>
            <SelectItem value="__unassigned__">— Nicht zugewiesen —</SelectItem>
            {assigneeOptions.map(a => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant={overdueOnly ? 'default' : 'outline'} size="sm" onClick={() => setOverdueOnly(v => !v)}>
          <AlertTriangle className="w-4 h-4 mr-1" /> Nur überfällig
        </Button>
        <Button variant="outline" size="sm" onClick={load}>Aktualisieren</Button>
        <Button variant="outline" size="sm" onClick={() => exportCsv(filtered)}><Download className="w-4 h-4 mr-1" /> CSV Export</Button>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-3 flex flex-wrap items-center gap-2 sticky top-2 z-10 backdrop-blur">
          <Badge className="bg-primary/20 text-primary border-primary/40">{selected.size} ausgewählt</Badge>
          <Select onValueChange={(v) => bulkUpdate({ status: v }, `Status → ${STATUS_LABEL[v]}`)}>
            <SelectTrigger className="w-[200px] h-8 text-xs" disabled={bulkBusy}><SelectValue placeholder="Status setzen…" /></SelectTrigger>
            <SelectContent>
              {STATUS_ORDER.map(s => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select onValueChange={(v) => bulkUpdate({ assigned_user_id: v === '__none__' ? null : v }, v === '__none__' ? 'Zuweisung entfernt' : 'Zugewiesen')}>
            <SelectTrigger className="w-[220px] h-8 text-xs" disabled={bulkBusy}><SelectValue placeholder="Zuständigen setzen…" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="__none__">— Nicht zugewiesen —</SelectItem>
              {staffList.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs" disabled={bulkBusy}><CalendarClock className="w-3.5 h-3.5 mr-1" /> Frist setzen</Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" onSelect={(d) => d && bulkUpdate({ due_date: format(d, 'yyyy-MM-dd') }, `Frist ${format(d, 'dd.MM.yyyy')}`)} initialFocus className={cn('p-3 pointer-events-auto')} />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="sm" className="h-8 text-xs" disabled={bulkBusy} onClick={() => bulkUpdate({ due_date: null }, 'Frist entfernt')}>Frist entfernen</Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => exportCsv(filtered.filter(r => selected.has(r.id)))}>
            <Download className="w-3.5 h-3.5 mr-1" /> Auswahl exportieren
          </Button>
          <div className="ml-auto flex items-center gap-1">
            {bulkBusy && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setSelected(new Set())}><X className="w-4 h-4" /></Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 p-8 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Lade…</div>
      ) : view === 'list' ? (
        <ListView rows={filtered} selected={selected} onToggle={toggleOne} onToggleAll={(checked) => toggleAll(filtered.map(r => r.id), checked)} />
      ) : (
        <KanbanView grouped={grouped} />
      )}
    </div>
  );
}

function Kpi({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone?: 'red' | 'amber' | 'sky' }) {
  const toneClass = tone === 'red' ? 'border-red-500/40 bg-red-500/5' : tone === 'amber' ? 'border-amber-500/40 bg-amber-500/5' : tone === 'sky' ? 'border-sky-500/40 bg-sky-500/5' : 'border-border bg-card';
  return (
    <div className={cn('rounded-xl border p-3 card-glow', toneClass)}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        {icon}
      </div>
      <div className="text-2xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <Badge variant="outline" className={cn('text-[10px]', STATUS_TONE[status])}>{STATUS_LABEL[status] || status}</Badge>;
}

function ListView({ rows, selected, onToggle, onToggleAll }: { rows: MpRow[]; selected: Set<string>; onToggle: (id: string) => void; onToggleAll: (checked: boolean) => void }) {
  if (rows.length === 0) {
    return <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Keine Mediapakete gefunden.</div>;
  }
  const allChecked = rows.length > 0 && rows.every(r => selected.has(r.id));
  const someChecked = rows.some(r => selected.has(r.id));
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden card-glow">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50">
            <tr className="text-left text-xs text-muted-foreground">
              <th className="p-3 w-8">
                <Checkbox checked={allChecked ? true : someChecked ? 'indeterminate' : false} onCheckedChange={(c) => onToggleAll(!!c)} />
              </th>
              <th className="p-3">Auftrag</th>
              <th className="p-3">Kunde / Studio</th>
              <th className="p-3">Status</th>
              <th className="p-3">Fortschritt</th>
              <th className="p-3">Frist</th>
              <th className="p-3">Zuständig</th>
              <th className="p-3">Aktualisiert</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const overdue = r.due_date && r.status !== 'completed' && new Date(r.due_date) < new Date();
              return (
                <tr key={r.id} className={cn('border-t border-border hover:bg-secondary/30 transition', selected.has(r.id) && 'bg-primary/5')}>
                  <td className="p-3"><Checkbox checked={selected.has(r.id)} onCheckedChange={() => onToggle(r.id)} /></td>
                  <td className="p-3 font-medium">{r._order_number || '—'}</td>
                  <td className="p-3">
                    <div className="truncate max-w-[220px]">{r._customer_name || '—'}</div>
                    {r.studio_name && <div className="text-xs text-muted-foreground truncate max-w-[220px]">{r.studio_name}</div>}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={r.status} />
                      {(r._unread_count || 0) > 0 && (
                        <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/40 text-[10px] animate-pulse">{r._unread_count}</Badge>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="w-24 h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full gold-gradient" style={{ width: `${r.progress_percent || 0}%` }} />
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1">{r.progress_percent || 0}%</div>
                  </td>
                  <td className="p-3">
                    {r.due_date ? (
                      <span className={cn('text-xs', overdue && 'text-red-400 font-medium')}>
                        {format(new Date(r.due_date), 'dd.MM.yyyy')}
                        {overdue && <AlertTriangle className="w-3 h-3 inline ml-1" />}
                      </span>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="p-3 text-xs">{r._assignee_name || <span className="text-muted-foreground">—</span>}</td>
                  <td className="p-3 text-xs text-muted-foreground">{format(new Date(r.updated_at), 'dd.MM.yyyy HH:mm')}</td>
                  <td className="p-3">
                    {r.order_id && (
                      <Link to={`/auftraege/${r.order_id}?tab=mediapaket`}>
                        <Button size="sm" variant="ghost" className="h-7 px-2"><ExternalLink className="w-3.5 h-3.5" /></Button>
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KanbanView({ grouped }: { grouped: Record<string, MpRow[]> }) {
  return (
    <div className="grid grid-flow-col auto-cols-[minmax(260px,1fr)] gap-3 overflow-x-auto pb-2">
      {STATUS_ORDER.map(s => (
        <div key={s} className="rounded-xl border border-border bg-card/50 p-3 min-h-[200px]">
          <div className="flex items-center justify-between mb-2">
            <StatusBadge status={s} />
            <span className="text-xs text-muted-foreground">{grouped[s]?.length || 0}</span>
          </div>
          <div className="space-y-2">
            {(grouped[s] || []).map(r => {
              const overdue = r.due_date && s !== 'completed' && new Date(r.due_date) < new Date();
              return (
                <Link key={r.id} to={r.order_id ? `/auftraege/${r.order_id}?tab=mediapaket` : '#'} className="block rounded-lg border border-border bg-background/60 p-2 hover:border-primary/40 transition">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-medium truncate">{r._order_number || 'Ohne Auftrag'}</span>
                    {(r._unread_count || 0) > 0 && <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/40 text-[10px]">{r._unread_count}</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{r._customer_name || r.studio_name || '—'}</div>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{r.progress_percent || 0}%</span>
                    {r.due_date && (
                      <span className={cn(overdue && 'text-red-400 font-medium')}>{format(new Date(r.due_date), 'dd.MM.')}</span>
                    )}
                  </div>
                  {r._assignee_name && (
                    <div className="mt-1 text-[10px] text-muted-foreground truncate">👤 {r._assignee_name}</div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
