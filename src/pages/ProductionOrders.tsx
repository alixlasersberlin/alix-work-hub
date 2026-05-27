import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, Loader2, Factory, Users as UsersIcon, FileText, Pencil, Trash2, AlertTriangle,
  Search, Calendar, Truck, User, Package, Hash, ArrowUpDown, CheckCircle2, XCircle, Clock, Mail,
} from 'lucide-react';
import { sendProductionOrderEmail } from '@/lib/send-production-order-email';
import { toast } from 'sonner';
import { format, differenceInCalendarDays, isValid } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { PageSizeSelector, usePagination, PaginationControls } from '@/components/PageSizeSelector';
import { useViewMode } from '@/hooks/useViewMode';
import { ViewToggle } from '@/components/ViewToggle';
import { useAuth } from '@/hooks/useAuth';
import { Warehouse } from 'lucide-react';
import {
  findLagerMatch,
  lagerFoundNote,
  LAGER_NOTE_MARKER,
  LAGER_MISSING_MARKER,
  stripLagerMarkers,
  type LagerDeviceRow,
  type LagerMatch,
} from '@/lib/lager-match';

type Mode = 'order' | 'reclamation';
type Lang = 'de' | 'en' | 'zh';
type SortKey = 'created_desc' | 'liefertermin_asc' | 'liefertermin_desc' | 'order_asc';

const LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: 'de', label: 'DE', flag: '🇩🇪' },
  { code: 'en', label: 'EN', flag: '🇬🇧' },
  { code: 'zh', label: 'ZH', flag: '🇨🇳' },
];

const T: Record<Lang, Record<string, string>> = {
  de: {
    title: 'ORDER – Produktionsbestellungen',
    subtitle: 'Bestellungen an die Produktion verwalten und versenden',
    suppliers: 'Zulieferer', newOrder: 'Neue Bestellung', empty: 'Noch keine Bestellungen vorhanden.',
    noResults: 'Keine Treffer für die aktuellen Filter.',
    confirmDelete: 'Bestellung wirklich löschen?', deleted: 'Bestellung gelöscht',
    searchPh: 'Suche nach Nummer, Modell, Bearbeiter, Zulieferer…',
    allStatus: 'Alle Status', allPayment: 'Alle Payment',
    sort: 'Sortierung',
    s_created_desc: 'Neueste zuerst', s_liefertermin_asc: 'Liefertermin ↑', s_liefertermin_desc: 'Liefertermin ↓', s_order_asc: 'Bestellnummer',
    intern: 'Intern', model: 'Modell', handler: 'Bearbeiter', delivery: 'Liefertermin',
    payment: 'Payment', status: 'Status', actions: 'Aktionen', supplier: 'Zulieferer',
    overdue: 'überfällig', dueToday: 'heute fällig', dueIn: 'in', days: 'Tagen',
    p_Ja: 'Ja', p_Nein: 'Nein', p_Teilweise: 'Teilweise', p_Garantie: 'Garantie',
    total: 'Einträge',
  },
  en: {
    title: 'ORDER – Production Orders', subtitle: 'Manage and dispatch production orders',
    suppliers: 'Suppliers', newOrder: 'New order', empty: 'No orders yet.',
    noResults: 'No matches for current filters.',
    confirmDelete: 'Really delete this order?', deleted: 'Order deleted',
    searchPh: 'Search by number, model, handler, supplier…',
    allStatus: 'All statuses', allPayment: 'All payment',
    sort: 'Sort',
    s_created_desc: 'Newest first', s_liefertermin_asc: 'Delivery ↑', s_liefertermin_desc: 'Delivery ↓', s_order_asc: 'Order no.',
    intern: 'Internal', model: 'Model', handler: 'Handler', delivery: 'Delivery',
    payment: 'Payment', status: 'Status', actions: 'Actions', supplier: 'Supplier',
    overdue: 'overdue', dueToday: 'due today', dueIn: 'in', days: 'days',
    p_Ja: 'Yes', p_Nein: 'No', p_Teilweise: 'Partial', p_Garantie: 'Warranty',
    total: 'entries',
  },
  zh: {
    title: 'ORDER – 生产订单', subtitle: '管理并发送生产订单',
    suppliers: '供应商', newOrder: '新建订单', empty: '暂无订单。',
    noResults: '当前筛选无匹配结果。',
    confirmDelete: '确定要删除此订单吗？', deleted: '订单已删除',
    searchPh: '按编号、型号、处理人、供应商搜索…',
    allStatus: '所有状态', allPayment: '所有付款',
    sort: '排序',
    s_created_desc: '最新优先', s_liefertermin_asc: '交期 ↑', s_liefertermin_desc: '交期 ↓', s_order_asc: '订单号',
    intern: '内部', model: '型号', handler: '处理人', delivery: '交货日期',
    payment: '付款', status: '状态', actions: '操作', supplier: '供应商',
    overdue: '逾期', dueToday: '今日到期', dueIn: '剩', days: '天',
    p_Ja: '是', p_Nein: '否', p_Teilweise: '部分', p_Garantie: '保修',
    total: '条',
  },
};

const PAYMENT_VALUES = ['Ja', 'Nein', 'Teilweise', 'Garantie'] as const;

function paymentClasses(ps: string) {
  switch (ps) {
    case 'Ja': return 'bg-green-500/15 text-green-500 border border-green-500/30';
    case 'Teilweise': return 'bg-yellow-500/15 text-yellow-500 border border-yellow-500/30';
    case 'Garantie': return 'bg-blue-500/15 text-blue-500 border border-blue-500/30';
    default: return 'bg-destructive/15 text-destructive border border-destructive/30';
  }
}

function statusClasses(status: string) {
  const s = (status || '').toLowerCase();
  if (s.includes('gesendet') || s.includes('versendet')) return 'bg-blue-500/15 text-blue-500 border border-blue-500/30';
  if (s.includes('produktion') || s.includes('bearbeitung')) return 'bg-yellow-500/15 text-yellow-500 border border-yellow-500/30';
  if (s.includes('geliefert') || s.includes('abgeschlossen') || s.includes('erledigt')) return 'bg-green-500/15 text-green-500 border border-green-500/30';
  if (s.includes('storno')) return 'bg-destructive/15 text-destructive border border-destructive/30';
  return 'bg-primary/10 text-primary border border-primary/30';
}

export default function ProductionOrders({ mode = 'order' }: { mode?: Mode } = {}) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('production_lang') as Lang) || 'de');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [approvalFilter, setApprovalFilter] = useState<string>('all');
  const [sort, setSort] = useState<SortKey>('created_desc');
  const [viewMode, setViewMode] = useViewMode();
  const { hasRole, user } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const [lagerMatches, setLagerMatches] = useState<Record<string, LagerMatch | 'none'>>({});

  const t = T[lang];
  const navigate = useNavigate();
  const isReclamation = mode === 'reclamation';
  const basePath = isReclamation ? '/order/reklamation' : '/order';

  useEffect(() => { localStorage.setItem('production_lang', lang); }, [lang]);

  const tPayment = (p: string) => t[`p_${p}`] ?? p;

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('production_orders')
      .select('*, supplier:suppliers(name, email)')
      .eq('is_reclamation', isReclamation)
      .order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    else {
      const list = (data || []).map((r: any) => ({
        ...r,
        display_order_number: r.production_order_number || r.order_number,
      }));
      setRows(list);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [isReclamation]);

  // Auto-Check: prüft jede Bestellung gegen freie Lagergeräte (Lager/Unterwegs/Produktion/Warehouse/Hold).
  // Bei Treffer: Gerät auf order_id reservieren + Notiz in production_orders.anmerkungen anhängen.
  // Bei Miss: einmalige Notiz "muss bestellt werden" in anmerkungen anhängen.
  useEffect(() => {
    if (loading || rows.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data: devData } = await supabase
        .from('lager_devices')
        .select('id, serial_number, model_name, notes, reserved_order_id')
        .is('reserved_order_id', null);
      if (cancelled) return;
      const devices = (devData as LagerDeviceRow[]) ?? [];
      const used = new Set<string>();
      const result: Record<string, LagerMatch | 'none'> = {};

      for (const r of rows) {
        if (!r.order_id) continue;
        if ((r.anmerkungen || '').includes(LAGER_NOTE_MARKER)) {
          // already checked once — read previous result from note
          if ((r.anmerkungen || '').includes('Im Lager gefunden')) {
            // we don't have device here, skip badge (will display generic)
          }
          continue;
        }
        const pool = devices.filter(d => !used.has(d.id));
        const match = findLagerMatch(r.modellname, r.farbe, pool);
        if (match) {
          used.add(match.device.id);
          // claim device (only if still unreserved)
          const { data: claimed, error: claimErr } = await supabase
            .from('lager_devices')
            .update({ reserved_order_id: r.order_id })
            .eq('id', match.device.id)
            .is('reserved_order_id', null)
            .select('id');
          if (claimErr || !claimed || claimed.length === 0) continue;
          const note = lagerFoundNote(match.department, match.device.serial_number);
          const newAnm = r.anmerkungen ? `${r.anmerkungen}\n${note}` : note;
          await supabase.from('production_orders').update({ anmerkungen: newAnm }).eq('id', r.id);
          result[r.id] = match;
        } else {
          const newAnm = r.anmerkungen
            ? `${r.anmerkungen}\n${LAGER_MISSING_MARKER}`
            : LAGER_MISSING_MARKER;
          await supabase.from('production_orders').update({ anmerkungen: newAnm }).eq('id', r.id);
          result[r.id] = 'none';
        }
      }
      if (cancelled) return;
      // also derive badge state for rows that were previously checked
      for (const r of rows) {
        if (result[r.id]) continue;
        const anm = r.anmerkungen || '';
        if (anm.includes('Im Lager gefunden')) {
          // parse department from previous note
          const m = /Abteilung\s+([^,\]]+)/.exec(anm);
          const sn = /SN\s+([^\]]+)/.exec(anm);
          if (m) {
            result[r.id] = {
              device: { id: '', serial_number: (sn?.[1] || '').trim(), model_name: '', notes: null, reserved_order_id: null },
              department: m[1].trim() as any,
            };
          }
        } else if (anm.includes(LAGER_NOTE_MARKER)) {
          result[r.id] = 'none';
        }
      }
      setLagerMatches(result);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, rows.length]);


  const remove = async (id: string) => {
    if (!confirm(t.confirmDelete)) return;
    const { error } = await supabase.from('production_orders').delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success(t.deleted);
    load();
  };

  const approve = async (id: string) => {
    const { error } = await supabase.from('production_orders').update({
      approval_status: 'approved',
      approved_by: user?.id ?? null,
      approved_at: new Date().toISOString(),
      approval_note: null,
    } as any).eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Bestellung genehmigt');
    load();
  };

  const [sendingId, setSendingId] = useState<string | null>(null);
  const sendEmail = async (id: string) => {
    setSendingId(id);
    const toastId = toast.loading('E-Mail wird versendet…');
    try {
      const res = await sendProductionOrderEmail(id);
      if (res.ok) toast.success(res.message, { id: toastId });
      else toast.error(res.message, { id: toastId });
      if (res.ok) load();
    } finally {
      setSendingId(null);
    }
  };

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => r.status && set.add(r.status));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = rows.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (paymentFilter !== 'all' && (r.payment_status || 'Nein') !== paymentFilter) return false;
      if (approvalFilter !== 'all' && (r.approval_status || 'pending') !== approvalFilter) return false;
      if (!q) return true;
      const hay = [
        r.display_order_number, r.order_number, r.production_order_number,
        r.modellname, r.bearbeiter, r.sonderwuensche, r.seriennummer,
        r.supplier?.name,
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
    out = [...out].sort((a, b) => {
      switch (sort) {
        case 'liefertermin_asc':
          return (a.liefertermin || '').localeCompare(b.liefertermin || '');
        case 'liefertermin_desc':
          return (b.liefertermin || '').localeCompare(a.liefertermin || '');
        case 'order_asc':
          return (a.display_order_number || '').localeCompare(b.display_order_number || '');
        default:
          return (b.created_at || '').localeCompare(a.created_at || '');
      }
    });
    return out;
  }, [rows, search, statusFilter, paymentFilter, approvalFilter, sort]);

  const { pageSize, setPageSize, page, setPage, totalPages, paged, total } = usePagination(filtered, 20);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dueLabel = (date: string | null) => {
    if (!date) return null;
    const d = new Date(date); if (!isValid(d)) return null;
    const diff = differenceInCalendarDays(d, today);
    if (diff < 0) return { label: `${Math.abs(diff)} ${t.days} ${t.overdue}`, cls: 'text-destructive' };
    if (diff === 0) return { label: t.dueToday, cls: 'text-yellow-500' };
    if (diff <= 7) return { label: `${t.dueIn} ${diff} ${t.days}`, cls: 'text-yellow-500' };
    return null;
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4 md:space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-display font-bold gold-text flex items-center gap-2">
            {isReclamation
              ? <><AlertTriangle className="w-5 h-5 md:w-6 md:h-6" /> Reklamation</>
              : <><Factory className="w-5 h-5 md:w-6 md:h-6" /> {t.title}</>}
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            {isReclamation ? 'Reklamationsbestellungen verwalten und versenden' : t.subtitle}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {!isReclamation && (
            <Button variant="outline" size="sm" onClick={() => navigate('/order/zulieferer')}>
              <UsersIcon className="w-4 h-4 mr-2" /> {t.suppliers}
            </Button>
          )}
          <Button size="sm" onClick={() => navigate(`${basePath}/neu`)}>
            <Plus className="w-4 h-4 mr-2" /> {isReclamation ? 'Neue Reklamation' : t.newOrder}
          </Button>
        </div>
      </div>

      {/* Toolbar: Search + Filters + Lang */}
      <Card className="p-3 md:p-4 space-y-3">
        <div className="flex flex-col lg:flex-row gap-2 lg:items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t.searchPh}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 lg:flex lg:gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-full lg:w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.allStatus}</SelectItem>
                {statusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="h-9 w-full lg:w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.allPayment}</SelectItem>
                {PAYMENT_VALUES.map(p => <SelectItem key={p} value={p}>{tPayment(p)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={approvalFilter} onValueChange={setApprovalFilter}>
              <SelectTrigger className="h-9 w-full lg:w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Freigaben</SelectItem>
                <SelectItem value="pending">Wartet auf Freigabe</SelectItem>
                <SelectItem value="approved">Genehmigt</SelectItem>
                <SelectItem value="rejected">Abgelehnt</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v: SortKey) => setSort(v)}>
              <SelectTrigger className="h-9 w-full lg:w-[180px] col-span-2 md:col-span-1">
                <ArrowUpDown className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_desc">{t.s_created_desc}</SelectItem>
                <SelectItem value="liefertermin_asc">{t.s_liefertermin_asc}</SelectItem>
                <SelectItem value="liefertermin_desc">{t.s_liefertermin_desc}</SelectItem>
                <SelectItem value="order_asc">{t.s_order_asc}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            {LANGS.map(l => (
              <button
                key={l.code}
                type="button"
                onClick={() => setLang(l.code)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors",
                  lang === l.code
                    ? "bg-primary/10 text-primary border-primary/40"
                    : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}
              >
                <span>{l.flag}</span><span>{l.label}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {filtered.length} / {rows.length} {t.total}
            </span>
            <ViewToggle value={viewMode} onChange={setViewMode} />
            <PageSizeSelector value={pageSize} onChange={setPageSize} />
          </div>
        </div>
      </Card>

      {/* Liste */}
      {loading ? (
        <Card className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></Card>
      ) : rows.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">{t.empty}</Card>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">{t.noResults}</Card>
      ) : (
        <>
          {/* Karten-Ansicht (immer mobil; auf Desktop wenn cards) */}
          <div className={cn(viewMode === 'cards' ? 'grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3' : 'lg:hidden space-y-2.5')}>
            {paged.map(r => {
              const ps = r.payment_status || 'Nein';
              const due = dueLabel(r.liefertermin);
              return (
                <Card key={r.id} className="p-3.5 hover:border-primary/40 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-0.5">
                        <Hash className="w-3 h-3" />
                        <span className="truncate">{r.order_number}</span>
                      </div>
                      <div className="font-mono font-semibold text-sm text-foreground truncate">
                        {r.display_order_number}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      <span className={cn('px-2 py-0.5 rounded text-[10px] font-medium', statusClasses(r.status))}>{r.status}</span>
                      <span className={cn('px-2 py-0.5 rounded text-[10px] font-medium', paymentClasses(ps))}>{tPayment(ps)}</span>
                      {(() => {
                        const lm = lagerMatches[r.id];
                        if (!lm) return null;
                        if (lm === 'none') {
                          return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border" title="Nicht im Lager — muss bestellt werden">
                            <Warehouse className="w-3 h-3" /> Kein Lager
                          </span>;
                        }
                        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-500 border border-emerald-500/30" title={`Reserviert: ${lm.device.serial_number}`}>
                          <Warehouse className="w-3 h-3" /> {lm.department}
                        </span>;
                      })()}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Truck className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">{r.supplier?.name || '—'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Package className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">{r.modellname || '—'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <User className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">{r.bearbeiter}</span>
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">
                        {r.liefertermin ? format(new Date(r.liefertermin), 'dd.MM.yyyy') : '—'}
                      </span>
                    </div>
                  </div>
                  {(due || r.sonderwuensche) && (
                    <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-border/50 text-[11px]">
                      {r.sonderwuensche
                        ? <span className="font-mono uppercase text-muted-foreground truncate">{r.sonderwuensche}</span>
                        : <span />}
                      {due && <span className={cn('font-medium', due.cls)}>{due.label}</span>}
                    </div>
                  )}
                  <div className="flex justify-end gap-0.5 mt-2 pt-2 border-t border-border/50">
                    <Button asChild size="sm" variant="ghost" className="h-8 w-8 p-0"><Link to={`${basePath}/${r.id}`}><FileText className="w-4 h-4" /></Link></Button>
                    <Button asChild size="sm" variant="ghost" className="h-8 w-8 p-0"><Link to={`${basePath}/${r.id}/bearbeiten`}><Pencil className="w-4 h-4" /></Link></Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-primary hover:text-primary hover:bg-primary/10"
                      onClick={() => sendEmail(r.id)}
                      disabled={sendingId === r.id || (r.approval_status || 'pending') !== 'approved'}
                      title={(r.approval_status || 'pending') !== 'approved' ? 'Erst nach Freigabe versendbar' : 'E-Mail an Zulieferer senden'}
                    >
                      {sendingId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => remove(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Desktop: Tabelle (nur in Zeilen-Modus) */}
          <Card className={cn('p-0 overflow-hidden', viewMode === 'cards' ? 'hidden' : 'hidden lg:block')}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="p-3 font-medium">Nummer</th>
                    <th className="p-3 font-medium">{t.intern}</th>
                    <th className="p-3 font-medium">{t.supplier}</th>
                    <th className="p-3 font-medium">{t.model}</th>
                    <th className="p-3 font-medium">{t.handler}</th>
                    <th className="p-3 font-medium">{t.delivery}</th>
                    <th className="p-3 font-medium">{t.payment}</th>
                    <th className="p-3 font-medium">{t.status}</th>
                    <th className="p-3 font-medium">Lager</th>
                    <th className="p-3 font-medium">Freigabe</th>
                    <th className="p-3 font-medium text-right">{t.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map(r => {
                    const ps = r.payment_status || 'Nein';
                    const due = dueLabel(r.liefertermin);
                    return (
                      <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="p-3">
                          <div className="font-mono font-semibold text-foreground">{r.display_order_number}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{r.order_number}</div>
                        </td>
                        <td className="p-3 font-mono uppercase text-xs">{r.sonderwuensche || '—'}</td>
                        <td className="p-3">{r.supplier?.name || '—'}</td>
                        <td className="p-3">{r.modellname || '—'}</td>
                        <td className="p-3">{r.bearbeiter}</td>
                        <td className="p-3">
                          <div>{r.liefertermin ? format(new Date(r.liefertermin), 'dd.MM.yyyy', { locale: de }) : '—'}</div>
                          {due && <div className={cn('text-[10px] font-medium', due.cls)}>{due.label}</div>}
                        </td>
                        <td className="p-3"><span className={cn('px-2 py-0.5 rounded text-xs font-medium', paymentClasses(ps))}>{tPayment(ps)}</span></td>
                        <td className="p-3"><span className={cn('px-2 py-0.5 rounded text-xs font-medium', statusClasses(r.status))}>{r.status}</span></td>
                        <td className="p-3">
                          {(() => {
                            const lm = lagerMatches[r.id];
                            if (!lm) return <span className="text-muted-foreground text-xs">—</span>;
                            if (lm === 'none') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground border border-border" title="Nicht im Lager — muss bestellt werden"><Warehouse className="w-3 h-3" /> Kein Lager</span>;
                            return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/15 text-emerald-500 border border-emerald-500/30" title={`Reserviert: ${lm.device.serial_number}`}><Warehouse className="w-3 h-3" /> {lm.department}</span>;
                          })()}
                        </td>
                        <td className="p-3">
                          {(() => {
                            const a = r.approval_status || 'pending';
                            const cls = a === 'approved'
                              ? 'bg-green-500/15 text-green-500 border border-green-500/30'
                              : a === 'rejected'
                                ? 'bg-destructive/15 text-destructive border border-destructive/30'
                                : 'bg-yellow-500/15 text-yellow-500 border border-yellow-500/30';
                            const Icon = a === 'approved' ? CheckCircle2 : a === 'rejected' ? XCircle : Clock;
                            const label = a === 'approved' ? 'Genehmigt' : a === 'rejected' ? 'Abgelehnt' : 'Wartet';
                            return <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium', cls)}><Icon className="w-3 h-3" /> {label}</span>;
                          })()}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          {isSuperAdmin && (r.approval_status || 'pending') !== 'approved' && (
                            <Button size="sm" variant="ghost" className="h-8 px-2 text-green-500 hover:text-green-500 hover:bg-green-500/10" onClick={() => approve(r.id)} title="Genehmigen">
                              <CheckCircle2 className="w-4 h-4" />
                            </Button>
                          )}
                          <Button asChild size="sm" variant="ghost" className="h-8 w-8 p-0"><Link to={`${basePath}/${r.id}`}><FileText className="w-4 h-4" /></Link></Button>
                          <Button asChild size="sm" variant="ghost" className="h-8 w-8 p-0"><Link to={`${basePath}/${r.id}/bearbeiten`}><Pencil className="w-4 h-4" /></Link></Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-primary hover:text-primary hover:bg-primary/10"
                            onClick={() => sendEmail(r.id)}
                            disabled={sendingId === r.id || (r.approval_status || 'pending') !== 'approved'}
                            title={(r.approval_status || 'pending') !== 'approved' ? 'Erst nach Freigabe versendbar' : 'E-Mail an Zulieferer senden'}
                          >
                            {sendingId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => remove(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} total={total} />
        </>
      )}
    </div>
  );
}
