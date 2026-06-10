import { useEffect, useState } from 'react';
import { FileText, Loader2, Inbox, Plus } from 'lucide-react';
import { PageHeader } from '@/components/PageShell';
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
      <div className="flex justify-between items-start mb-2">
        <PageHeader icon={<FileText className="w-6 h-6 text-primary" />} title="Verträge" subtitle={`${rows.length} Verträge`} />
        {canWrite && <Button disabled className="gold-gradient text-primary-foreground"><Plus className="w-4 h-4 mr-2" />Neuer Vertrag (folgt)</Button>}
      </div>
      <div className="rounded-xl border border-border bg-card card-glow overflow-hidden">
        {loading ? (
          <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground"><Inbox className="w-8 h-8 mx-auto mb-2 opacity-50" />Noch keine Verträge angelegt.</div>
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
