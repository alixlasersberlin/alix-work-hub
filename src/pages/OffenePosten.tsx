import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarIcon, FileText, Loader2, RefreshCw, Pencil } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { PageHeader } from '@/components/PageShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ListToolbar } from '@/components/finance/ListToolbar';
import { matchesQuery, paginate, type PageSize } from '@/lib/finance/list-filter';

type WorkflowStatus = 'offen' | 'rueckstellung' | 'in_klaerung' | 'inkasso' | 'erledigt';

type OpenItem = {
  id: string;
  source: 'invoice' | 'recurring';
  invoice_number: string | null;
  reference_number: string | null;
  customer_name: string | null;
  city: string | null;
  billing_address: string | null;
  due_date: string | null;
  total: number | null;
  balance: number | null;
  currency: string | null;
  status: string | null;
};

type WorkflowState = {
  source: string;
  invoice_key: string;
  workflow_status: WorkflowStatus;
  note: string | null;
  updated_at: string;
};

type Bucket = 'overdue_30' | 'overdue_7' | 'overdue' | 'due_soon' | 'upcoming';

const bucketFor = (due: string | null): Bucket => {
  if (!due) return 'upcoming';
  const days = differenceInCalendarDays(parseISO(due), new Date());
  if (days < -30) return 'overdue_30';
  if (days < -7) return 'overdue_7';
  if (days < 0) return 'overdue';
  if (days <= 7) return 'due_soon';
  return 'upcoming';
};

const bucketStyles: Record<Bucket, { row: string; label: string; badge: string }> = {
  overdue_30: { row: 'bg-destructive/15 hover:bg-destructive/20', label: '> 30 Tage überfällig', badge: 'bg-destructive text-destructive-foreground' },
  overdue_7: { row: 'bg-destructive/10 hover:bg-destructive/15', label: '> 7 Tage überfällig', badge: 'bg-destructive/80 text-destructive-foreground' },
  overdue: { row: 'bg-orange-500/10 hover:bg-orange-500/15', label: 'Überfällig', badge: 'bg-orange-500 text-white' },
  due_soon: { row: 'bg-yellow-500/10 hover:bg-yellow-500/15', label: 'Fällig in ≤ 7 Tagen', badge: 'bg-yellow-500 text-black' },
  upcoming: { row: 'hover:bg-muted/40', label: 'Zukünftig', badge: 'bg-muted text-muted-foreground' },
};

const workflowOptions: { value: WorkflowStatus; label: string; badge: string }[] = [
  { value: 'offen', label: 'Offen', badge: 'bg-muted text-muted-foreground' },
  { value: 'rueckstellung', label: 'Rückstellung', badge: 'bg-blue-500/15 text-blue-400 border border-blue-500/30' },
  { value: 'in_klaerung', label: 'In Klärung', badge: 'bg-amber-500/15 text-amber-400 border border-amber-500/30' },
  { value: 'inkasso', label: 'Übergabe Inkasso', badge: 'bg-violet-500/15 text-violet-300 border border-violet-500/30' },
  { value: 'erledigt', label: 'Erledigt', badge: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' },
];

const workflowLabel = (s: WorkflowStatus) => workflowOptions.find((o) => o.value === s)?.label ?? s;
const workflowBadge = (s: WorkflowStatus) => workflowOptions.find((o) => o.value === s)?.badge ?? '';

const formatCurrency = (n: number | null, currency: string | null) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: currency || 'EUR' }).format(n ?? 0);

export default function OffenePosten() {
  const [items, setItems] = useState<OpenItem[]>([]);
  const [workflows, setWorkflows] = useState<Record<string, WorkflowState>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [dateFrom, setDateFrom] = useState<Date>(new Date(new Date().getFullYear(), 0, 1));
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  const [editItem, setEditItem] = useState<OpenItem | null>(null);
  const [editStatus, setEditStatus] = useState<WorkflowStatus>('offen');
  const [editNote, setEditNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: invoices, error: e1 }, { data: recurring, error: e2 }, { data: wf, error: e3 }] =
      await Promise.all([
        supabase
          .from('zoho_invoices')
          .select('id, invoice_number, customer_name, due_date, total, balance, currency, status')
          .gt('balance', 0)
          .order('due_date', { ascending: true })
          .limit(1000),
        supabase
          .from('zoho_recurring_invoices')
          .select('id, invoice_number, customer_name, due_date, total, balance, currency, status')
          .gt('balance', 0)
          .order('due_date', { ascending: true })
          .limit(1000),
        supabase
          .from('invoice_workflow_states')
          .select('source, invoice_key, workflow_status, note, updated_at')
          .limit(2000),
      ]);
    if (e1 || e2 || e3) toast.error('Fehler beim Laden: ' + (e1?.message || e2?.message || e3?.message));
    const merged: OpenItem[] = [
      ...((invoices ?? []).map((i: any) => ({ ...i, source: 'invoice' as const }))),
      ...((recurring ?? []).map((i: any) => ({ ...i, source: 'recurring' as const }))),
    ];
    merged.sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''));
    setItems(merged);
    const map: Record<string, WorkflowState> = {};
    (wf ?? []).forEach((w: any) => {
      map[`${w.source}-${w.invoice_key}`] = w as WorkflowState;
    });
    setWorkflows(map);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    let totalImported = 0;
    let totalUpdated = 0;
    let page = 1;
    const fromStr = format(dateFrom, 'yyyy-MM-dd');
    const toStr = dateTo ? format(dateTo, 'yyyy-MM-dd') : undefined;
    try {
      for (let i = 0; i < 20; i++) {
        const { data, error } = await supabase.functions.invoke('sync-zoho-invoices', {
          body: { source_system: 'zoho_eu_1', date_from: fromStr, date_to: toStr, page, per_page: 200, max_pages: 5 },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        totalImported += data?.imported ?? 0;
        totalUpdated += data?.updated ?? 0;
        if (!data?.has_more) break;
        page = (data.last_page ?? page) + 1;
      }
      toast.success(`Sync fertig: ${totalImported} neu, ${totalUpdated} aktualisiert`);
      await load();
    } catch (e: any) {
      toast.error('Sync fehlgeschlagen: ' + (e?.message ?? 'Unbekannt'));
    } finally {
      setSyncing(false);
    }
  }, [load, dateFrom, dateTo]);

  const openEdit = (item: OpenItem) => {
    const key = `${item.source}-${item.id}`;
    const existing = workflows[key];
    setEditItem(item);
    setEditStatus(existing?.workflow_status ?? 'offen');
    setEditNote(existing?.note ?? '');
  };

  const saveEdit = async () => {
    if (!editItem) return;
    setSaving(true);
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    const payload = {
      source: editItem.source,
      invoice_key: editItem.id,
      invoice_number: editItem.invoice_number,
      workflow_status: editStatus,
      note: editNote || null,
      updated_by: uid,
      created_by: uid,
    };
    const { error } = await supabase
      .from('invoice_workflow_states')
      .upsert(payload, { onConflict: 'source,invoice_key' });
    setSaving(false);
    if (error) {
      toast.error('Speichern fehlgeschlagen: ' + error.message);
      return;
    }
    toast.success('Status gespeichert');
    setWorkflows((prev) => ({
      ...prev,
      [`${editItem.source}-${editItem.id}`]: {
        source: editItem.source,
        invoice_key: editItem.id,
        workflow_status: editStatus,
        note: editNote || null,
        updated_at: new Date().toISOString(),
      },
    }));
    setEditItem(null);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => i.invoice_number?.toLowerCase().includes(q) || i.customer_name?.toLowerCase().includes(q),
    );
  }, [items, search]);

  const totals = useMemo(() => {
    const sum = filtered.reduce((acc, i) => acc + (Number(i.balance) || 0), 0);
    const overdue = filtered
      .filter((i) => bucketFor(i.due_date).startsWith('overdue'))
      .reduce((acc, i) => acc + (Number(i.balance) || 0), 0);
    return { sum, overdue, count: filtered.length };
  }, [filtered]);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          icon={<FileText className="w-5 h-5" />}
          title="Offene Posten"
          subtitle="Alle fälligen Rechnungen, farblich nach Fälligkeit"
        />
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Von</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[160px] justify-start text-left font-normal gap-2">
                  <CalendarIcon className="w-4 h-4" />
                  {format(dateFrom, 'dd.MM.yyyy', { locale: de })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={(d) => d && setDateFrom(d)} initialFocus className={cn('p-3 pointer-events-auto')} />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Bis (optional)</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-[160px] justify-start text-left font-normal gap-2', !dateTo && 'text-muted-foreground')}>
                  <CalendarIcon className="w-4 h-4" />
                  {dateTo ? format(dateTo, 'dd.MM.yyyy', { locale: de }) : 'heute'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className={cn('p-3 pointer-events-auto')} />
                {dateTo && (
                  <div className="p-2 border-t border-border">
                    <Button variant="ghost" size="sm" className="w-full" onClick={() => setDateTo(undefined)}>Zurücksetzen</Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
          <Button onClick={handleSync} disabled={syncing} className="gap-2">
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Abgleichen & Importieren
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Offene Posten</div>
          <div className="text-2xl font-semibold mt-1">{totals.count}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Offener Betrag</div>
          <div className="text-2xl font-semibold mt-1">{formatCurrency(totals.sum, 'EUR')}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Davon überfällig</div>
          <div className="text-2xl font-semibold mt-1 text-destructive">{formatCurrency(totals.overdue, 'EUR')}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="Suche Rechnung oder Kunde…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <div className="flex flex-wrap gap-2 ml-auto text-xs">
          {(Object.keys(bucketStyles) as Bucket[]).map((b) => (
            <span key={b} className={cn('px-2 py-1 rounded', bucketStyles[b].badge)}>{bucketStyles[b].label}</span>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-8 flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Lade…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Keine offenen Posten gefunden.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rechnung</TableHead>
                <TableHead>Kunde</TableHead>
                <TableHead>Fällig am</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Bearbeitung</TableHead>
                <TableHead className="text-right">Gesamt</TableHead>
                <TableHead className="text-right">Offen</TableHead>
                <TableHead className="text-right">Aktion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((i) => {
                const b = bucketFor(i.due_date);
                const style = bucketStyles[b];
                const days = i.due_date ? differenceInCalendarDays(parseISO(i.due_date), new Date()) : null;
                const wf = workflows[`${i.source}-${i.id}`];
                const wfStatus: WorkflowStatus = wf?.workflow_status ?? 'offen';
                return (
                  <TableRow key={`${i.source}-${i.id}`} className={style.row}>
                    <TableCell className="font-mono">
                      {i.invoice_number ?? '—'}
                      {i.source === 'recurring' && (
                        <Badge variant="outline" className="ml-2 text-[10px]">Abo</Badge>
                      )}
                    </TableCell>
                    <TableCell>{i.customer_name ?? '—'}</TableCell>
                    <TableCell>
                      {i.due_date ? format(parseISO(i.due_date), 'dd.MM.yyyy', { locale: de }) : '—'}
                      {days !== null && (
                        <div className="text-xs text-muted-foreground">
                          {days < 0 ? `${Math.abs(days)} Tage überfällig` : days === 0 ? 'heute fällig' : `in ${days} Tagen`}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={cn('px-2 py-0.5 rounded text-xs', style.badge)}>{style.label}</span>
                    </TableCell>
                    <TableCell>
                      <span className={cn('px-2 py-0.5 rounded text-xs', workflowBadge(wfStatus))}>
                        {workflowLabel(wfStatus)}
                      </span>
                      {wf?.note && (
                        <div className="text-xs text-muted-foreground mt-1 max-w-[220px] truncate" title={wf.note}>
                          {wf.note}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(i.total, i.currency)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(i.balance, i.currency)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(i)} className="gap-1">
                        <Pencil className="w-3.5 h-3.5" /> Bearbeiten
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Offenen Posten bearbeiten</DialogTitle>
            <DialogDescription>
              {editItem?.invoice_number} · {editItem?.customer_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Bearbeitungsstatus</Label>
              <Select value={editStatus} onValueChange={(v) => setEditStatus(v as WorkflowStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {workflowOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notiz</Label>
              <Textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} rows={4} placeholder="Optionale Notiz zur Bearbeitung…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)} disabled={saving}>Abbrechen</Button>
            <Button onClick={saveEdit} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
