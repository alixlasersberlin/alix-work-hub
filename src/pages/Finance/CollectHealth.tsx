import { useEffect, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/infinity/PageHeader';
import { SkeletonTable } from '@/components/infinity/Skeleton';
import { EmptyState } from '@/components/infinity/EmptyState';

const GRADE: Record<string, string> = {
  A: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  B: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  C: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  D: 'bg-orange-500/15 text-orange-500 border-orange-500/30',
  E: 'bg-destructive/15 text-destructive border-destructive/30',
};

const Bar = ({ value }: { value: number }) => (
  <div className="h-2 w-24 rounded-full bg-muted">
    <div
      className={`h-2 rounded-full ${value >= 70 ? 'bg-emerald-500' : value >= 45 ? 'bg-amber-500' : 'bg-destructive'}`}
      style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
    />
  </div>
);

export default function FinanceCollectHealth() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('collect_health_scores' as any).select('*').order('score', { ascending: true }).limit(500);
    if (error) toast({ title: 'Laden fehlgeschlagen', description: error.message, variant: 'destructive' });
    setRows((data as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const recompute = async () => {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke('collect-analytics');
    setRunning(false);
    if (error) { toast({ title: 'Berechnung fehlgeschlagen', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Neu berechnet', description: `${(data as any)?.health_scores ?? 0} Kunden, ${(data as any)?.limits_adjusted ?? 0} Kreditlimits angepasst` });
    load();
  };

  const filtered = rows.filter((r) => !search || (r.customer_name ?? '').toLowerCase().includes(search.toLowerCase()));
  const avg = rows.length ? Math.round(rows.reduce((a, r) => a + Number(r.score ?? 0), 0) / rows.length) : 0;
  const critical = rows.filter((r) => Number(r.score ?? 0) < 45).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Customer Health Score" subtitle="Gesamtwert 0–100 aus Umsatz, Reklamationen, Service, Rücklastschriften, Mahnungen, Bonität und Beziehungsalter" icon={Activity} />

      <div className="grid gap-4 md:grid-cols-3">
        <DataCard title="Bewertete Kunden"><div className="text-2xl font-semibold">{rows.length}</div></DataCard>
        <DataCard title="Durchschnitt"><div className="text-2xl font-semibold">{avg}</div></DataCard>
        <DataCard title="Kritisch (&lt; 45)"><div className="text-2xl font-semibold text-destructive">{critical}</div></DataCard>
      </div>

      <DataCard title="Scores">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Input className="w-72" placeholder="Kunde suchen…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="flex-1" />
          <Button variant="outline" onClick={recompute} disabled={running}>
            <RefreshCw className={`mr-2 h-4 w-4 ${running ? 'animate-spin' : ''}`} />Neu berechnen
          </Button>
        </div>
        {loading ? (
          <SkeletonTable rows={8} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Activity} title="Noch keine Scores" description="Starte die Berechnung, um Health-Scores zu erzeugen." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-3">Kunde</th>
                  <th className="py-2 pr-3">Score</th>
                  <th className="py-2 pr-3">Note</th>
                  <th className="py-2 pr-3">Zahlungstreue</th>
                  <th className="py-2 pr-3">Mahnhistorie</th>
                  <th className="py-2 pr-3">Reklamationen</th>
                  <th className="py-2 pr-3">Rücklastschriften</th>
                  <th className="py-2 pr-3">Beziehung</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-border/50">
                    <td className="py-2 pr-3 font-medium">{r.customer_name}</td>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2"><Bar value={Number(r.score ?? 0)} /><span>{r.score}</span></div>
                    </td>
                    <td className="py-2 pr-3"><Badge variant="outline" className={GRADE[r.grade] ?? ''}>{r.grade ?? '—'}</Badge></td>
                    <td className="py-2 pr-3">{r.response_score}</td>
                    <td className="py-2 pr-3">{r.dunning_score}</td>
                    <td className="py-2 pr-3">{r.complaint_score}</td>
                    <td className="py-2 pr-3">{r.return_debit_score}</td>
                    <td className="py-2 pr-3">{(r.components as any)?.tenure_months ?? 0} Mon.</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>
    </div>
  );
}
