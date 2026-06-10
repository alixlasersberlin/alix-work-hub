import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Play, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, PageLoading, DataCard, PageEmpty } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

const eur = (n: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n ?? 0);

export default function FinanceKonsolidierung() {
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('finance_consolidation_runs' as any)
      .select('id, period_month, status, tenant_count, gross_total, eliminated_total, consolidated_total, created_at, notes')
      .order('period_month', { ascending: false })
      .limit(60);
    if (error) toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    setRuns((data ?? []) as any[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const startRun = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('finance-consolidation-run', {
        body: { period_month: period, notes: notes || undefined },
      });
      if (error) throw error;
      toast({
        title: 'Konsolidierung erstellt',
        description: `Brutto ${eur((data as any)?.gross_total ?? 0)} – Konsolidiert ${eur((data as any)?.consolidated_total ?? 0)}`,
      });
      setNotes('');
      await load();
    } catch (e: any) {
      toast({ title: 'Fehler', description: e.message, variant: 'destructive' });
    }
    setBusy(false);
  };

  if (loading) return <PageLoading />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Konzern-Konsolidierung"
        subtitle="Mandantenübergreifende Monatskonsolidierung mit Intercompany-Eliminierung"
        icon={Building2}
      />

      <DataCard title="Neuen Lauf starten">
        <div className="p-4 flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Periode (Monat)</label>
            <Input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-48"
            />
          </div>
          <div className="space-y-1 flex-1">
            <label className="text-xs text-muted-foreground">Notiz (optional)</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Bemerkung zum Lauf" />
          </div>
          <Button onClick={startRun} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            Konsolidieren
          </Button>
        </div>
      </DataCard>

      <DataCard title={`${runs.length} Konsolidierungs-Läufe`}>
        {runs.length === 0 ? (
          <PageEmpty message="Noch keine Läufe vorhanden." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/40 text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Periode</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-right p-3">Mandanten</th>
                  <th className="text-right p-3">Brutto</th>
                  <th className="text-right p-3">Eliminiert</th>
                  <th className="text-right p-3">Konsolidiert</th>
                  <th className="text-left p-3">Erstellt</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-b border-border/20">
                    <td className="p-3 font-medium">{(r.period_month ?? '').slice(0, 7)}</td>
                    <td className="p-3"><Badge variant="outline">{r.status}</Badge></td>
                    <td className="p-3 text-right">{r.tenant_count}</td>
                    <td className="p-3 text-right">{eur(Number(r.gross_total))}</td>
                    <td className="p-3 text-right text-destructive">-{eur(Number(r.eliminated_total))}</td>
                    <td className="p-3 text-right font-semibold">{eur(Number(r.consolidated_total))}</td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString('de-DE')}
                    </td>
                    <td className="p-3 text-right">
                      <Link to={`/finance/konsolidierung/${r.id}`} className="text-primary hover:underline text-xs">
                        Details
                      </Link>
                    </td>
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
