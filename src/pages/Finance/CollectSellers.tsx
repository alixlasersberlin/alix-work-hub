import { useEffect, useState } from 'react';
import { Trophy, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/infinity/PageHeader';
import { SkeletonTable } from '@/components/infinity/Skeleton';
import { EmptyState } from '@/components/infinity/EmptyState';

const eur = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n || 0));

export default function FinanceCollectSellers() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('collect_seller_scores' as any).select('*').order('payment_quality_pct', { ascending: false }).limit(200);
    if (error) toast({ title: 'Laden fehlgeschlagen', description: error.message, variant: 'destructive' });
    setRows((data as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const recompute = async () => {
    setRunning(true);
    const { error } = await supabase.functions.invoke('collect-analytics');
    setRunning(false);
    if (error) { toast({ title: 'Berechnung fehlgeschlagen', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Verkäuferbewertung aktualisiert' });
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Verkäuferbewertung" subtitle="Zahlungsqualität je Verkäufer – wer verkauft an Kunden, die pünktlich zahlen?" icon={Trophy} />

      <DataCard title="Ranking">
        <div className="mb-3 flex justify-end">
          <Button variant="outline" onClick={recompute} disabled={running}>
            <RefreshCw className={`mr-2 h-4 w-4 ${running ? 'animate-spin' : ''}`} />Neu berechnen
          </Button>
        </div>
        {loading ? (
          <SkeletonTable rows={6} />
        ) : rows.length === 0 ? (
          <EmptyState icon={Trophy} title="Keine Daten" description="Starte die Berechnung, sobald Fälle Verkäufer zugeordnet haben." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Verkäufer</th>
                  <th className="py-2 pr-3">Zahlungsqualität</th>
                  <th className="py-2 pr-3">Kunden</th>
                  <th className="py-2 pr-3">Offen</th>
                  <th className="py-2 pr-3">Überfällig</th>
                  <th className="py-2 pr-3">Ø Verzug</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const q = Number(r.payment_quality_pct ?? 0);
                  return (
                    <tr key={r.id} className="border-b border-border/50">
                      <td className="py-2 pr-3 text-muted-foreground">{i + 1}</td>
                      <td className="py-2 pr-3 font-medium">{r.seller_name}</td>
                      <td className="py-2 pr-3">
                        <Badge variant="outline" className={q >= 85 ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-500' : q >= 60 ? 'border-amber-500/30 bg-amber-500/15 text-amber-500' : 'border-destructive/30 bg-destructive/15 text-destructive'}>
                          {Math.round(q)} %
                        </Badge>
                      </td>
                      <td className="py-2 pr-3">{r.customers_count}</td>
                      <td className="py-2 pr-3">{eur(r.invoiced_amount)}</td>
                      <td className="py-2 pr-3">{eur(r.overdue_amount)}</td>
                      <td className="py-2 pr-3">{r.avg_days_overdue} Tage</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>
    </div>
  );
}
