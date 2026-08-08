import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, AlertTriangle, Ban, BarChart3, Bot, Clock, Gavel, ListTodo, RefreshCw,
  Scale, Sparkles, TrendingUp, Wallet,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/infinity/PageHeader';
import { SkeletonTable } from '@/components/infinity/Skeleton';

const fmt = (n: any, cur = 'EUR') =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(Number(n ?? 0));

function Tile({ label, value, icon: Icon, tone, sub }: { label: string; value: string; icon: any; tone?: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</div>
      <div className={`mt-1 font-display text-xl font-semibold ${tone ?? 'text-foreground'}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export default function FinanceCollectCommand() {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('collect_dashboard' as any);
    if (error) toast({ title: 'Laden fehlgeschlagen', description: error.message, variant: 'destructive' });
    setD(data ?? null);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const run = async (fn: string, label: string) => {
    setBusy(fn);
    const { error } = await supabase.functions.invoke(fn, { body: {} });
    setBusy(null);
    if (error) { toast({ title: `${label} fehlgeschlagen`, description: error.message, variant: 'destructive' }); return; }
    toast({ title: `${label} abgeschlossen` });
    load();
  };

  if (loading) return <div className="space-y-4"><SkeletonTable /></div>;

  const liq = (d?.liquidity ?? []) as any[];
  const exp = d?.expected ?? {};
  const rec = d?.receivables ?? {};
  const aging = (d?.aging ?? []) as any[];
  const top = (d?.top_debtors ?? []) as any[];
  const totalLiq = liq.reduce((s, a) => s + Number(a.balance ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Collection Command Center"
        subtitle="ALIX COLLECT 2.0 · Liquidität, Risiko und Maßnahmen auf einen Blick"
        icon={Activity}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild><Link to="/finance/collect/liste">Prioritätenliste</Link></Button>
            <Button variant="outline" size="sm" asChild><Link to="/finance/collect/aufgaben"><ListTodo className="h-4 w-4 mr-2" />Aufgaben</Link></Button>
            <Button variant="outline" size="sm" asChild><Link to="/finance/collect/auswertungen"><BarChart3 className="h-4 w-4 mr-2" />Auswertungen</Link></Button>
            <Button variant="outline" size="sm" asChild><Link to="/finance/collect/copilot"><Bot className="h-4 w-4 mr-2" />Finance AI</Link></Button>
            <Button size="sm" disabled={busy !== null} onClick={() => run('collect-engine', 'Aktualisierung')}>
              <RefreshCw className={`h-4 w-4 mr-2 ${busy === 'collect-engine' ? 'animate-spin' : ''}`} />Aktualisieren
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <DataCard title="Liquidität heute" className="lg:col-span-2">
          <div className="mb-3 font-display text-2xl font-semibold text-emerald-400">{fmt(totalLiq)}</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {liq.length === 0 && <p className="text-sm text-muted-foreground">Keine Bankkonten hinterlegt.</p>}
            {liq.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border border-border p-2 text-sm">
                <span className="text-muted-foreground">{a.bank_name} · {a.account_name}</span>
                <span className="font-medium">{fmt(a.balance, a.currency ?? 'EUR')}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <Tile label="Erwartet heute" value={fmt(exp.today)} icon={Clock} />
            <Tile label="Morgen" value={fmt(exp.tomorrow)} icon={Clock} />
            <Tile label="Diese Woche" value={fmt(exp.this_week)} icon={Clock} />
            <Tile label="Diesen Monat" value={fmt(exp.this_month)} icon={Clock} />
          </div>
        </DataCard>

        <DataCard title="KI-Prognose" icon={<Sparkles className="h-4 w-4 text-primary" />}>
          <p className="text-sm text-muted-foreground">Heute werden voraussichtlich</p>
          <div className="font-display text-3xl font-semibold text-primary">{fmt(rec.ai_expected_today)}</div>
          <p className="text-sm text-muted-foreground">eingehen.</p>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Prognose 7 Tage</span><span>{fmt(d?.forecast?.d7)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Prognose 30 Tage</span><span>{fmt(d?.forecast?.d30)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Prognose 90 Tage</span><span>{fmt(d?.forecast?.d90)}</span></div>
            <div className="flex justify-between border-t border-border pt-2"><span className="text-muted-foreground">Zugesagte Zahlungen (7 T)</span><span>{fmt(exp.promises)}</span></div>
          </div>
        </DataCard>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Offene Forderungen" value={fmt(rec.open_total)} icon={Wallet} sub={`${rec.case_count ?? 0} Fälle`} />
        <Tile label="Überfällig" value={fmt(rec.overdue_total)} icon={AlertTriangle} tone="text-red-400" />
        <Tile label="Kritische Forderungen" value={fmt(rec.critical_total)} icon={Gavel} tone="text-orange-400" sub={`${rec.critical_count ?? 0} Fälle > 60 Tage`} />
        <Tile label="Ausfallrisiko" value={fmt(rec.risk_amount)} icon={Scale} tone="text-red-400" />
      </div>

      <DataCard title="Leitstand">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile label="Zahlungseingänge heute" value={fmt(d?.payments_today?.amount)} icon={TrendingUp} tone="text-emerald-400" sub={`${d?.payments_today?.count ?? 0} Buchungen`} />
          <Tile label="Offene Aufgaben heute" value={String(d?.tasks_today ?? 0)} icon={ListTodo} />
          <Tile label="Offene Zahlungsversprechen" value={String(d?.promises_open ?? 0)} icon={Clock} sub={`${d?.promises_broken ?? 0} gebrochen`} />
          <Tile label="Rücklastschriften" value={String(d?.return_debits ?? 0)} icon={AlertTriangle} tone="text-amber-400" />
          <Tile label="Aktive Sperren" value={String(d?.blocks_active ?? 0)} icon={Ban} />
          <Tile label="Inkasso / Gericht" value={String(d?.legal_cases ?? 0)} icon={Gavel} />
          <Tile label="Insolvenzen" value={String(d?.insolvencies ?? 0)} icon={Scale} />
        </div>
      </DataCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <DataCard title="Altersstruktur">
          <div className="space-y-2">
            {aging.map((b) => (
              <div key={b.bucket} className="flex items-center justify-between rounded-lg border border-border p-2 text-sm">
                <span className="text-muted-foreground">{b.bucket} Tage</span>
                <span className="flex items-center gap-3"><Badge variant="outline">{b.cnt}</Badge><span className="font-medium">{fmt(b.amount)}</span></span>
              </div>
            ))}
            {aging.length === 0 && <p className="text-sm text-muted-foreground">Keine Daten.</p>}
          </div>
        </DataCard>

        <DataCard title="Größte Schuldner">
          <div className="space-y-2">
            {top.map((t) => (
              <Link key={t.id} to={`/finance/collect/${t.id}`} className="flex items-center justify-between rounded-lg border border-border p-2 text-sm hover:bg-muted/30">
                <span className="font-medium text-primary">{t.customer_name ?? '–'}</span>
                <span className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{t.max_days_overdue ?? 0} T · {t.pay_probability_pct ?? '–'}%</span>
                  <span className="font-medium text-red-400">{fmt(t.overdue_amount)}</span>
                </span>
              </Link>
            ))}
            {top.length === 0 && <p className="text-sm text-muted-foreground">Keine Daten.</p>}
          </div>
        </DataCard>
      </div>
    </div>
  );
}
