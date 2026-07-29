import { useEffect, useMemo, useState } from 'react';
import { TrendingUp, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAccountingRegion } from '@/contexts/AccountingRegionContext';

type Summary = { revenue: number; variable_cost: number; db1: number; fixed_cost: number; db2: number };

const fmt = (v: number, cur: string) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: cur }).format(Number(v || 0));

export default function Deckungsbeitrag() {
  const { region } = useAccountingRegion();
  const cur = region === 'CH' ? 'CHF' : 'EUR';
  const today = new Date();
  const first = new Date(today.getFullYear(), 0, 1);
  const [from, setFrom] = useState(first.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [s, setS] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('finance_db_summary', {
      p_region: region, p_from: from, p_to: to,
    } as any);
    if (error) toast.error(error.message);
    else setS(((data as any) ?? [])[0] ?? { revenue: 0, variable_cost: 0, db1: 0, fixed_cost: 0, db2: 0 });
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [region]);

  const db1Margin = useMemo(() => s && Number(s.revenue) > 0 ? (Number(s.db1) / Number(s.revenue)) * 100 : 0, [s]);
  const db2Margin = useMemo(() => s && Number(s.revenue) > 0 ? (Number(s.db2) / Number(s.revenue)) * 100 : 0, [s]);

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <PageHeader
        title={`Deckungsbeitragsrechnung · ${region === 'CH' ? '🇨🇭 Schweiz' : '🇪🇺 EU'}`}
        subtitle="DB1 = Erlöse − variable Kosten · DB2 = DB1 − Fixkosten"
        icon={TrendingUp}
      />

      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div><Label>Von</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label>Bis</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          <Button onClick={load} disabled={loading}><RefreshCw className="w-4 h-4 mr-2" />Berechnen</Button>
        </CardContent>
      </Card>

      {s && (
        <Card>
          <CardHeader><CardTitle>Kalkulationsschema</CardTitle></CardHeader>
          <CardContent className="p-6">
            <div className="max-w-2xl space-y-2 font-mono text-sm">
              <Row label="Umsatzerlöse" value={fmt(Number(s.revenue), cur)} bold />
              <Row label="./. Variable Kosten" value={`− ${fmt(Number(s.variable_cost), cur)}`} muted />
              <div className="border-t border-border pt-2">
                <Row label="= Deckungsbeitrag I (DB1)"
                     value={`${fmt(Number(s.db1), cur)}  (${db1Margin.toFixed(1)} %)`}
                     bold highlight />
              </div>
              <Row label="./. Fixkosten" value={`− ${fmt(Number(s.fixed_cost), cur)}`} muted />
              <div className="border-t border-border pt-2">
                <Row label="= Deckungsbeitrag II (DB2 · Betriebsergebnis)"
                     value={`${fmt(Number(s.db2), cur)}  (${db2Margin.toFixed(1)} %)`}
                     bold highlight
                     negative={Number(s.db2) < 0} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value, bold, muted, highlight, negative }: any) {
  return (
    <div className={`flex justify-between py-1 ${bold ? 'font-semibold' : ''} ${muted ? 'text-muted-foreground' : ''} ${highlight ? 'text-primary text-base' : ''} ${negative ? 'text-destructive' : ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
