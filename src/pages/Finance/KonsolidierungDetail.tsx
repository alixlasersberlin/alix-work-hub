import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Building2, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, PageLoading, DataCard, PageEmpty } from '@/components/PageShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const eur = (n: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n ?? 0);

export default function FinanceKonsolidierungDetail() {
  const { id } = useParams<{ id: string }>();
  const [run, setRun] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [tenants, setTenants] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: r }, { data: it }, { data: t }] = await Promise.all([
        supabase.from('finance_consolidation_runs' as any).select('*').eq('id', id).maybeSingle(),
        supabase.from('finance_consolidation_items' as any).select('*').eq('run_id', id),
        supabase.from('tenants' as any).select('id,name,flag_emoji'),
      ]);
      setRun(r);
      setItems((it ?? []) as any[]);
      const m: Record<string, string> = {};
      for (const x of (t ?? []) as any[]) m[x.id] = `${x.flag_emoji ?? ''} ${x.name}`.trim();
      setTenants(m);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <PageLoading />;
  if (!run) return <PageEmpty message="Lauf nicht gefunden." />;

  // group items per tenant
  const byTenant = new Map<string, { gross: number; elim: number; cons: number; types: any[] }>();
  for (const i of items) {
    const key = i.tenant_id ?? 'ohne';
    let b = byTenant.get(key);
    if (!b) { b = { gross: 0, elim: 0, cons: 0, types: [] }; byTenant.set(key, b); }
    b.gross += Number(i.gross_amount);
    b.elim += Number(i.eliminated_amount);
    b.cons += Number(i.consolidated_amount);
    b.types.push(i);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Konsolidierung ${(run.period_month ?? '').slice(0, 7)}`}
        subtitle={run.notes ?? undefined}
        icon={Building2}
        actions={<Button asChild variant="outline" size="sm"><Link to="/finance/konsolidierung"><ArrowLeft className="h-4 w-4 mr-1.5" />Zurück</Link></Button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <DataCard><div className="p-4"><div className="text-xs text-muted-foreground">Status</div><div className="mt-1"><Badge>{run.status}</Badge></div></div></DataCard>
        <DataCard><div className="p-4"><div className="text-xs text-muted-foreground">Brutto</div><div className="text-xl font-semibold mt-1">{eur(Number(run.gross_total))}</div></div></DataCard>
        <DataCard><div className="p-4"><div className="text-xs text-muted-foreground">Eliminiert</div><div className="text-xl font-semibold mt-1 text-destructive">-{eur(Number(run.eliminated_total))}</div></div></DataCard>
        <DataCard><div className="p-4"><div className="text-xs text-muted-foreground">Konsolidiert</div><div className="text-xl font-semibold mt-1 text-primary">{eur(Number(run.consolidated_total))}</div></div></DataCard>
      </div>

      {[...byTenant.entries()].map(([tid, b]) => (
        <DataCard key={tid} title={tenants[tid] ?? (tid === 'ohne' ? 'Ohne Mandant' : tid)}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/40 text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Buchungsart</th>
                  <th className="text-right p-3">Brutto</th>
                  <th className="text-right p-3">Eliminiert</th>
                  <th className="text-right p-3">Konsolidiert</th>
                </tr>
              </thead>
              <tbody>
                {b.types.map((i: any) => (
                  <tr key={i.id} className="border-b border-border/20">
                    <td className="p-3">{i.transaction_type ?? '–'}</td>
                    <td className="p-3 text-right">{eur(Number(i.gross_amount))}</td>
                    <td className="p-3 text-right text-destructive">-{eur(Number(i.eliminated_amount))}</td>
                    <td className="p-3 text-right font-semibold">{eur(Number(i.consolidated_amount))}</td>
                  </tr>
                ))}
                <tr className="border-t border-border/40 bg-muted/20">
                  <td className="p-3 font-semibold">Summe</td>
                  <td className="p-3 text-right font-semibold">{eur(b.gross)}</td>
                  <td className="p-3 text-right text-destructive font-semibold">-{eur(b.elim)}</td>
                  <td className="p-3 text-right font-semibold">{eur(b.cons)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </DataCard>
      ))}
    </div>
  );
}
