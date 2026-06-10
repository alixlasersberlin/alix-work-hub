import { useEffect, useMemo, useState } from 'react';
import { Wallet, Loader2, Inbox } from 'lucide-react';
import { PageHeader } from '@/components/PageShell';
import { getTransactions } from '@/lib/finance/api';
import { ListToolbar } from '@/components/finance/ListToolbar';
import { matchesQuery, paginate, type PageSize } from '@/lib/finance/list-filter';

export default function FinanceAnzahlungen() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState<PageSize>(50);
  useEffect(() => {
    getTransactions({ transaction_type: 'Anzahlung' }).then(r => { setRows(r); setLoading(false); }).catch(() => setLoading(false));
  }, []);
  const fmt = (n: number) => Number(n || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  const filtered = useMemo(() => rows.filter((r) => matchesQuery({ ...r, total: r.amount, balance: r.amount }, search)), [rows, search]);
  const visible = useMemo(() => paginate(filtered, pageSize), [filtered, pageSize]);
  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader icon={<Wallet className="w-6 h-6 text-primary" />} title="Anzahlungen" subtitle={`${rows.length} Anzahlungen`} />
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
          <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
        ) : visible.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground"><Inbox className="w-8 h-8 mx-auto mb-2 opacity-50" />Keine Anzahlungen erfasst.</div>
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
                  <td className="px-4 py-2 text-right font-medium">{fmt(r.amount)}</td>
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
