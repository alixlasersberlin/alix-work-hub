import { useEffect, useState } from 'react';
import { FileText, Plus } from 'lucide-react';
import { PageHeader } from '@/components/infinity/PageHeader';
import { SkeletonTable } from '@/components/infinity/Skeleton';
import { EmptyState } from '@/components/infinity/EmptyState';
import { StatusBadge as InfinityStatusBadge } from '@/components/infinity/StatusBadge';
import { Button } from '@/components/ui/button';
import { listContracts } from '@/lib/finance/api';
import { useFinancePermissions } from '@/hooks/useFinancePermissions';
import { Badge } from '@/components/ui/badge';

export default function FinanceVertraege() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { canWrite } = useFinancePermissions();
  useEffect(() => {
    listContracts().then(r => { setRows(r); setLoading(false); }).catch(() => setLoading(false));
  }, []);
  const fmt = (n: number | null | undefined) => n != null ? Number(n).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) : '—';
  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        icon={FileText}
        title="Verträge"
        subtitle={`${rows.length} Verträge`}
        noBreadcrumbs
        meta={<InfinityStatusBadge kind={loading ? 'progress' : 'done'} label={loading ? 'Lädt' : `${rows.length}`} pulse={!loading} />}
        actions={canWrite ? <Button disabled className="gold-gradient text-primary-foreground"><Plus className="w-4 h-4 mr-2" />Neuer Vertrag (folgt)</Button> : undefined}
      />
      <div className="rounded-xl border border-border bg-card card-glow overflow-hidden">
        {loading ? (
          <div className="p-6"><SkeletonTable rows={8} cols={7} /></div>
        ) : rows.length === 0 ? (
          <div className="p-8"><EmptyState title="Keine Verträge" description="Noch keine Verträge angelegt." /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Vertragsnummer</th>
                <th className="text-left px-4 py-3">Typ</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Start</th>
                <th className="text-left px-4 py-3">Ende</th>
                <th className="text-right px-4 py-3">Monatsrate</th>
                <th className="text-right px-4 py-3">Restbetrag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(r => (
                <tr key={r.id} className="hover:bg-secondary/30">
                  <td className="px-4 py-2 font-medium">{r.contract_number || '—'}</td>
                  <td className="px-4 py-2">{r.contract_type}</td>
                  <td className="px-4 py-2"><Badge variant="outline">{r.status}</Badge></td>
                  <td className="px-4 py-2">{r.start_date ? new Date(r.start_date).toLocaleDateString('de-DE') : '—'}</td>
                  <td className="px-4 py-2">{r.end_date ? new Date(r.end_date).toLocaleDateString('de-DE') : '—'}</td>
                  <td className="px-4 py-2 text-right">{fmt(r.monthly_rate)}</td>
                  <td className="px-4 py-2 text-right">{fmt(r.remaining_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
