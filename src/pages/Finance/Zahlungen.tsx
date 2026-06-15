import { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine } from 'lucide-react';
import { PageHeader } from '@/components/infinity/PageHeader';
import { SkeletonTable } from '@/components/infinity/Skeleton';
import { EmptyState } from '@/components/infinity/EmptyState';
import { StatusBadge as InfinityStatusBadge } from '@/components/infinity/StatusBadge';
import { getTransactions } from '@/lib/finance/api';
import { ListToolbar } from '@/components/finance/ListToolbar';
import { matchesQuery, paginate, type PageSize } from '@/lib/finance/list-filter';

export default function FinanceZahlungen() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState<PageSize>(50);
  useEffect(() => {
    getTransactions({ transaction_type: 'Zahlung' }).then(r => { setRows(r); setLoading(false); }).catch(() => setLoading(false));
  }, []);
  const fmt = (n: number) => Number(n || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  const filtered = useMemo(() => rows.filter((r) => matchesQuery({ ...r, total: r.amount, balance: r.amount }, search)), [rows, search]);
  const visible = useMemo(() => paginate(filtered, pageSize), [filtered, pageSize]);
  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Zahlungen"
        subtitle={`${rows.length} Zahlungseingänge`}
        icon={ArrowDownToLine}
        noBreadcrumbs
        meta={<InfinityStatusBadge kind={loading ? 'progress' : 'done'} label={loading ? 'Lädt' : `${rows.length}`} pulse={!loading} />}
      />
      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        total={filtered.length}
        visible={visible.length}
      />
      <div className="rounded-xl border border-border bg-card card-glow overflow-hidden">
        {loading ? (
          <div className="p-6"><SkeletonTable rows={8} cols={4} /></div>
        ) : visible.length === 0 ? (
          <div className="p-8"><EmptyState title="Keine Zahlungen" description="Es wurden noch keine Zahlungseingänge erfasst." /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-muted-foreground">
              <tr><th className="text-left px-4 py-3">Datum</th><th className="text-left px-4 py-3">Referenz</th><th className="text-right px-4 py-3">Betrag</th><th className="text-left px-4 py-3">Notiz</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map(r => (
                <tr key={r.id} className="hover:bg-secondary/30">
                  <td className="px-4 py-2">{r.booking_date ? new Date(r.booking_date + 'T00:00:00').toLocaleDateString('de-DE') : '—'}</td>
                  <td className="px-4 py-2">{r.reference || '—'}</td>
                  <td className="px-4 py-2 text-right font-medium text-success">{fmt(r.amount)}</td>
                  <td className="px-4 py-2 text-muted-foreground">{r.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
