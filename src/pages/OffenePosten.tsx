import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarIcon, FileText, Loader2, RefreshCw } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { PageHeader } from '@/components/PageShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

type OpenItem = {
  id: string;
  source: 'invoice' | 'recurring';
  invoice_number: string | null;
  customer_name: string | null;
  due_date: string | null;
  total: number | null;
  balance: number | null;
  currency: string | null;
  status: string | null;
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
  overdue_30: {
    row: 'bg-destructive/15 hover:bg-destructive/20',
    label: '> 30 Tage überfällig',
    badge: 'bg-destructive text-destructive-foreground',
  },
  overdue_7: {
    row: 'bg-destructive/10 hover:bg-destructive/15',
    label: '> 7 Tage überfällig',
    badge: 'bg-destructive/80 text-destructive-foreground',
  },
  overdue: {
    row: 'bg-orange-500/10 hover:bg-orange-500/15',
    label: 'Überfällig',
    badge: 'bg-orange-500 text-white',
  },
  due_soon: {
    row: 'bg-yellow-500/10 hover:bg-yellow-500/15',
    label: 'Fällig in ≤ 7 Tagen',
    badge: 'bg-yellow-500 text-black',
  },
  upcoming: {
    row: 'hover:bg-muted/40',
    label: 'Zukünftig',
    badge: 'bg-muted text-muted-foreground',
  },
};

const formatCurrency = (n: number | null, currency: string | null) =>
  new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency || 'EUR',
  }).format(n ?? 0);

export default function OffenePosten() {
  const [items, setItems] = useState<OpenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: invoices, error: e1 }, { data: recurring, error: e2 }] =
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
      ]);
    if (e1 || e2) {
      toast.error('Fehler beim Laden: ' + (e1?.message || e2?.message));
    }
    const merged: OpenItem[] = [
      ...((invoices ?? []).map((i: any) => ({ ...i, source: 'invoice' as const }))),
      ...((recurring ?? []).map((i: any) => ({ ...i, source: 'recurring' as const }))),
    ];
    merged.sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''));
    setItems(merged);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    let totalImported = 0;
    let totalUpdated = 0;
    let page = 1;
    try {
      for (let i = 0; i < 20; i++) {
        const { data, error } = await supabase.functions.invoke('sync-zoho-invoices', {
          body: {
            source_system: 'zoho_eu_1',
            date_from: '2026-01-01',
            page,
            per_page: 200,
            max_pages: 5,
          },
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
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.invoice_number?.toLowerCase().includes(q) ||
        i.customer_name?.toLowerCase().includes(q),
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
        <Button onClick={handleSync} disabled={syncing} className="gap-2">
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Aus Zoho importieren (ab 01.01.2026)
        </Button>
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
          <div className="text-2xl font-semibold mt-1 text-destructive">
            {formatCurrency(totals.overdue, 'EUR')}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Suche Rechnung oder Kunde…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex flex-wrap gap-2 ml-auto text-xs">
          {(Object.keys(bucketStyles) as Bucket[]).map((b) => (
            <span key={b} className={cn('px-2 py-1 rounded', bucketStyles[b].badge)}>
              {bucketStyles[b].label}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-8 flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Lade…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            Keine offenen Posten gefunden.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rechnung</TableHead>
                <TableHead>Kunde</TableHead>
                <TableHead>Fällig am</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Gesamt</TableHead>
                <TableHead className="text-right">Offen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((i) => {
                const b = bucketFor(i.due_date);
                const style = bucketStyles[b];
                const days = i.due_date
                  ? differenceInCalendarDays(parseISO(i.due_date), new Date())
                  : null;
                return (
                  <TableRow key={`${i.source}-${i.id}`} className={style.row}>
                    <TableCell className="font-mono">
                      {i.invoice_number ?? '—'}
                      {i.source === 'recurring' && (
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          Abo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{i.customer_name ?? '—'}</TableCell>
                    <TableCell>
                      {i.due_date
                        ? format(parseISO(i.due_date), 'dd.MM.yyyy', { locale: de })
                        : '—'}
                      {days !== null && (
                        <div className="text-xs text-muted-foreground">
                          {days < 0
                            ? `${Math.abs(days)} Tage überfällig`
                            : days === 0
                              ? 'heute fällig'
                              : `in ${days} Tagen`}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={cn('px-2 py-0.5 rounded text-xs', style.badge)}>
                        {style.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(i.total, i.currency)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(i.balance, i.currency)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
