import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageError, DataCard } from '@/components/PageShell';
import { PageHeader } from '@/components/infinity/PageHeader';
import { SkeletonTable } from '@/components/infinity/Skeleton';
import { EmptyState } from '@/components/infinity/EmptyState';
import { StatusBadge as InfinityStatusBadge } from '@/components/infinity/StatusBadge';
import { ScrollText } from 'lucide-react';
import { ListToolbar } from '@/components/finance/ListToolbar';
import { matchesQuery, paginate, type PageSize } from '@/lib/finance/list-filter';
import { useAccountingRegion } from '@/contexts/AccountingRegionContext';

type Row = {
  id: string;
  source_system: string | null;
  zoho_recurring_invoice_id: string | null;
  customer_name: string | null;
  company_name: string | null;
  reference_number: string | null;
  status: string | null;
  total: number | null;
  next_invoice_date: string | null;
  last_sent_date: string | null;
  end_date: string | null;
  start_date: string | null;
  currency: string | null;
  raw_data: any;
};

function fmtMoney(n: number | null, c: string | null = 'EUR') {
  if (n == null) return '–';
  try { return new Intl.NumberFormat('de-DE', { style: 'currency', currency: c || 'EUR' }).format(n); }
  catch { return `${n.toFixed(2)} ${c ?? ''}`; }
}
function fmtDate(d: string | null) { if (!d) return '–'; try { return new Date(d).toLocaleDateString('de-DE'); } catch { return d; } }

/** Anzahl offener Monatsraten zwischen nächster Buchung und Laufzeitende (inkl.) */
function openMonths(r: Row): number | null {
  const from = r.next_invoice_date ?? r.start_date;
  if (!from || !r.end_date) return null;
  const a = new Date(from), b = new Date(r.end_date);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
  const m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1;
  return Math.max(0, m);
}

export default function FinanceRaten() {
  const { region } = useAccountingRegion();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState<PageSize>(100);
  const [dayTab, setDayTab] = useState<'all' | 1 | 15 | 'archive'>('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('zoho_recurring_profiles' as any)
        .select('id, source_system, zoho_recurring_invoice_id, customer_name, company_name, reference_number, status, total, next_invoice_date, last_sent_date, end_date, start_date, currency, raw_data')
        .eq('accounting_region', region)
        .limit(3000);
      if (cancelled) return;
      if (error) { setError(error.message); setRows([]); }
      else { setError(null); setRows((data ?? []) as any as Row[]); }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [region]);

  const dayOf = (r: Row) => {
    const d = r.next_invoice_date ?? r.start_date;
    if (!d) return null;
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? null : dt.getDate();
  };

  // Alphabetisch sortiert – Nummerierung folgt dem Alphabet
  const sorted = useMemo(
    () => rows.slice().sort((a, b) => (a.customer_name ?? '').localeCompare(b.customer_name ?? '', 'de')),
    [rows],
  );

  const isArchived = (r: Row) => (r.status ?? '').toLowerCase() === 'archived';

  const byDay = useMemo(() => {
    if (dayTab === 'archive') return sorted.filter(isArchived);
    const act = sorted.filter(r => !isArchived(r));
    return dayTab === 'all' ? act : act.filter(r => dayOf(r) === dayTab);
  }, [sorted, dayTab]);

  const counts = useMemo(() => {
    const act = rows.filter(r => !isArchived(r));
    return {
      all: act.length,
      d1: act.filter(r => dayOf(r) === 1).length,
      d15: act.filter(r => dayOf(r) === 15).length,
      archive: rows.filter(isArchived).length,
    };
  }, [rows]);

  const filtered = useMemo(() => byDay.filter(r => matchesQuery({
    ...r,
    amount: r.total,
    city: r.company_name,
    notes: r.raw_data?.iban ?? null,
    description: r.zoho_recurring_invoice_id,
  }, search)), [byDay, search]);

  const visible = useMemo(() => paginate(filtered, pageSize), [filtered, pageSize]);

  const monthlyTotal = useMemo(() => filtered.reduce((s, r) => s + Number(r.total ?? 0), 0), [filtered]);
  const openTotal = useMemo(() => filtered.reduce((s, r) => {
    const m = openMonths(r);
    return s + (m != null ? m * Number(r.total ?? 0) : 0);
  }, 0), [filtered]);

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        icon={ScrollText}
        title={`Laufende Raten · ${region === 'CH' ? '🇨🇭 CH' : '🇪🇺 EU'}`}
        subtitle="Periodische Rechnungs-Stammdaten & SEPA-Lastschriften"
        noBreadcrumbs
        meta={<InfinityStatusBadge kind={loading ? 'progress' : 'done'} label={loading ? 'Lädt' : `${rows.length}`} pulse={!loading} />}
      />

      <div className="flex flex-wrap gap-2 mb-4">
        {([
          { key: 'all' as const, label: 'Alle', count: counts.all },
          { key: 1 as const, label: 'Buchung 1. im Monat', count: counts.d1 },
          { key: 15 as const, label: 'Buchung 15. im Monat', count: counts.d15 },
          { key: 'archive' as const, label: 'Archiv', count: counts.archive },
        ]).map(t => (
          <button
            key={String(t.key)}
            type="button"
            onClick={() => setDayTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              dayTab === t.key
                ? 'bg-primary/15 border-primary/40 text-primary'
                : 'bg-card border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label} <span className="opacity-70">({t.count})</span>
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3 mb-4">
        <DataCard className="p-4">
          <div className="text-xs text-muted-foreground">Vorgänge</div>
          <div className="text-xl font-semibold">{filtered.length}</div>
        </DataCard>
        <DataCard className="p-4">
          <div className="text-xs text-muted-foreground">Monatlich gesamt</div>
          <div className="text-xl font-semibold tabular-nums">{fmtMoney(monthlyTotal)}</div>
        </DataCard>
        <DataCard className="p-4">
          <div className="text-xs text-muted-foreground">Offene Posten (Restsumme, live)</div>
          <div className="text-xl font-semibold tabular-nums text-primary">{fmtMoney(openTotal)}</div>
        </DataCard>
      </div>

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        total={filtered.length}
        visible={visible.length}
        placeholder="Suche: Kunde, Auftragsnr., Ort, IBAN, Betrag…"
      />

      {error && <PageError message={error} onRetry={() => location.reload()} />}
      {loading ? <DataCard className="p-6"><SkeletonTable rows={8} cols={9} /></DataCard> : visible.length === 0 ? (
        <DataCard className="p-8"><EmptyState title="Keine laufenden Raten" description="Es wurden keine Vorgänge gefunden." /></DataCard>
      ) : (
        <DataCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-3 font-medium">#</th>
                  <th className="text-left px-4 py-3 font-medium">Kunde</th>
                  <th className="text-left px-4 py-3 font-medium">Ort</th>
                  <th className="text-left px-4 py-3 font-medium">Auftrags-/Rechnungsnr.</th>
                  <th className="text-left px-4 py-3 font-medium">Vorgang</th>
                  <th className="text-left px-4 py-3 font-medium">Letzte Buchung</th>
                  <th className="text-left px-4 py-3 font-medium">Nächste</th>
                  <th className="text-left px-4 py-3 font-medium">Laufzeit</th>
                  <th className="text-right px-4 py-3 font-medium">Rate</th>
                  <th className="text-right px-4 py-3 font-medium">Offener Posten</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r, i) => {
                  const m = openMonths(r);
                  return (
                    <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                      <td className="px-3 py-3 text-xs text-muted-foreground tabular-nums">{i + 1}</td>
                      <td className="px-4 py-3">{(r.customer_name ?? '–').split(',')[0]}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.company_name ?? '–'}</td>
                      <td className="px-4 py-3">{r.reference_number ?? '–'}</td>
                      <td className="px-4 py-3 font-mono text-xs">{r.zoho_recurring_invoice_id ?? '–'}</td>
                      <td className="px-4 py-3">{fmtDate(r.last_sent_date)}</td>
                      <td className="px-4 py-3">{fmtDate(r.next_invoice_date)}</td>
                      <td className="px-4 py-3 text-xs">
                        {r.end_date ? `bis ${fmtDate(r.end_date)}${m != null ? ` · ${m} Mon.` : ''}` : '–'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(r.total, r.currency)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {m != null ? fmtMoney(m * Number(r.total ?? 0), r.currency) : '–'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DataCard>
      )}
    </div>
  );
}
