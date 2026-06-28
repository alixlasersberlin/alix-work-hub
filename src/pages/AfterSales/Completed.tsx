import { Link } from 'react-router-dom';
import { useAfterSalesCases } from '@/hooks/useAfterSales';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AfterSalesCompleted() {
  const { data = [], isLoading } = useAfterSalesCases({ completed: true });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Erledigte After-Sales-Fälle</h1>
        <p className="text-sm text-muted-foreground">{data.length} abgeschlossene Fälle</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Archiv</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? <p className="text-sm text-muted-foreground">Lade…</p> : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground uppercase">
                <tr className="border-b">
                  <th className="text-left py-2 pr-3">Auftrag</th>
                  <th className="text-left py-2 pr-3">Kunde</th>
                  <th className="text-left py-2 pr-3">Gerät</th>
                  <th className="text-left py-2 pr-3">Abgeschlossen</th>
                  <th className="text-left py-2 pr-3">Bewertung</th>
                </tr>
              </thead>
              <tbody>
                {data.map(c => (
                  <tr key={c.id} className="border-b hover:bg-muted/40">
                    <td className="py-2 pr-3">
                      <Link className="text-primary hover:underline" to={`/crm/after-sales/${c.id}`}>{c.order_number ?? '—'}</Link>
                    </td>
                    <td className="py-2 pr-3">{c.customer_company ?? c.customer_contact ?? '—'}</td>
                    <td className="py-2 pr-3">{c.device_model ?? '—'} {c.device_serial ? `· ${c.device_serial}` : ''}</td>
                    <td className="py-2 pr-3">{c.closed_at ? new Date(c.closed_at).toLocaleString('de-DE') : '—'}</td>
                    <td className="py-2 pr-3">{c.satisfaction_rating ? '★'.repeat(c.satisfaction_rating) : '—'}</td>
                  </tr>
                ))}
                {data.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Noch keine abgeschlossenen Fälle.</td></tr>}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
