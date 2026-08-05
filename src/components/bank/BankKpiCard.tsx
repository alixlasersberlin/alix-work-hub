import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Landmark, ArrowRight, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAccountingRegion } from '@/contexts/AccountingRegionContext';

const money = (n: number) => Number(n || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
const pct = (n: number) => `${Number(n || 0).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`;

/** Kompaktes Dashboard-Widget mit den wichtigsten Bank-Kennzahlen. */
export function BankKpiCard() {
  const { region } = useAccountingRegion();
  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState({ open: 0, openAmount: 0, suggestions: 0, returns: 0, quote: 0 });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const from = `${new Date().getFullYear()}-01-01`;
      const [openRes, sugRes, rdRes, inRes] = await Promise.all([
        supabase.from('bank_transactions' as any)
          .select('amount', { count: 'exact' }).eq('accounting_area', region).eq('status', 'offen').limit(1000),
        supabase.from('bank_transactions' as any)
          .select('id', { count: 'exact', head: true }).eq('accounting_area', region).in('status', ['vorschlag', 'sicher']),
        supabase.from('bank_return_debits' as any)
          .select('id', { count: 'exact', head: true }).eq('accounting_area', region)
          .neq('status', 'storniert').gte('booking_date', from),
        supabase.from('bank_transactions' as any)
          .select('id', { count: 'exact', head: true }).eq('accounting_area', region)
          .gt('amount', 0).gte('booking_date', from),
      ]);
      if (cancelled) return;
      const openAmount = ((openRes.data ?? []) as any[]).reduce((a, r) => a + Number(r.amount || 0), 0);
      const returns = rdRes.count ?? 0;
      const payments = inRes.count ?? 0;
      setKpi({
        open: openRes.count ?? 0,
        openAmount,
        suggestions: sugRes.count ?? 0,
        returns,
        quote: payments > 0 ? (returns / payments) * 100 : 0,
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [region]);

  return (
    <Card className="hover:border-primary/40 transition-colors">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Landmark className="w-4 h-4 text-primary" /> Bank &amp; Kontoauszüge
        </CardTitle>
        <Badge variant="outline">{region}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="py-4 text-center"><Loader2 className="w-4 h-4 animate-spin inline" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-2xl font-semibold">{kpi.open}</div>
                <div className="text-xs text-muted-foreground">offene Zuordnungen · {money(kpi.openAmount)}</div>
              </div>
              <div>
                <div className="text-2xl font-semibold">{kpi.suggestions}</div>
                <div className="text-xs text-muted-foreground">Vorschläge zu prüfen</div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className={`w-4 h-4 ${kpi.quote > 2 ? 'text-destructive' : 'text-muted-foreground'}`} />
              <span>{kpi.returns} Rücklastschriften · Quote {pct(kpi.quote)}</span>
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              <Link to="/finance/kontoauszuege/offen" className="text-primary hover:underline inline-flex items-center gap-1">
                Offene Zuordnungen <ArrowRight className="w-3 h-3" />
              </Link>
              <Link to="/finance/kontoauszuege/quote" className="text-primary hover:underline inline-flex items-center gap-1">
                Rücklastschriftquote <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default BankKpiCard;
