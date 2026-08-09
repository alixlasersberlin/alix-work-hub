import { TenantBadge } from '@/components/TenantBadge';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, RefreshCw, Sparkles, TrendingUp, Wallet, Clock, Gavel, Scale, Ban, Search,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/infinity/PageHeader';
import { SkeletonTable } from '@/components/infinity/Skeleton';
import { EmptyState } from '@/components/infinity/EmptyState';

type Kpis = Record<string, number>;

type CaseRow = {
  id: string;
  customer_name: string | null;
  tenant_id?: string | null;
  customer_email: string | null;
  currency: string | null;
  open_amount: number | null;
  overdue_amount: number | null;
  fee_amount: number | null;
  interest_amount: number | null;
  max_days_overdue: number | null;
  stage_code: string | null;
  ampel: string | null;
  status: string | null;
  risk_score: number | null;
  pay_probability_pct: number | null;
  risk_class: string | null;
  next_action: string | null;
  priority: number | null;
};

const fmt = (n: number | null | undefined, cur = 'EUR') =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(Number(n ?? 0));

const AMPEL: Record<string, string> = {
  gruen: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  gelb: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  orange: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  rot: 'bg-red-500/15 text-red-400 border-red-500/30',
  schwarz: 'bg-foreground/15 text-foreground border-foreground/30',
};

const RISK: Record<string, string> = {
  niedrig: 'text-emerald-400',
  mittel: 'text-amber-400',
  hoch: 'text-orange-400',
  kritisch: 'text-red-400',
};

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className={`mt-1 font-display text-xl font-semibold ${tone ?? 'text-foreground'}`}>{value}</div>
    </div>
  );
}

export default function FinanceCollect() {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('offen');
  const [sort, setSort] = useState('probability');

  const load = async () => {
    setLoading(true);
    const [k, c] = await Promise.all([
      supabase.rpc('collect_dashboard_kpis' as any),
      supabase.from('collect_cases' as any)
        .select('id, tenant_id, customer_name, customer_email, currency, open_amount, overdue_amount, fee_amount, interest_amount, max_days_overdue, stage_code, ampel, status, risk_score, pay_probability_pct, risk_class, next_action, priority')
        .neq('status', 'closed')
        .order('overdue_amount', { ascending: false })
        .limit(1000),
    ]);
    setKpis((k.data as any) ?? null);
    setCases(((c.data as any) ?? []) as CaseRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const run = async (fn: 'collect-engine' | 'collect-ai-score', label: string) => {
    setBusy(fn);
    const { data, error } = await supabase.functions.invoke(fn, { body: {} });
    setBusy(null);
    if (error) {
      toast({ title: `${label} fehlgeschlagen`, description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: `${label} abgeschlossen`, description: JSON.stringify(data) });
    load();
  };

  const filtered = useMemo(() => {
    let rows = cases;
    if (statusFilter !== 'alle') {
      rows = statusFilter === 'offen'
        ? rows.filter((r) => !['inkasso', 'anwalt', 'insolvenz'].includes(r.status ?? ''))
        : rows.filter((r) => r.status === statusFilter);
    }
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      rows = rows.filter((r) => (r.customer_name ?? '').toLowerCase().includes(s));
    }
    const sorted = [...rows];
    if (sort === 'probability') sorted.sort((a, b) => Number(b.pay_probability_pct ?? 0) - Number(a.pay_probability_pct ?? 0) || Number(b.overdue_amount ?? 0) - Number(a.overdue_amount ?? 0));
    if (sort === 'overdue') sorted.sort((a, b) => Number(b.overdue_amount ?? 0) - Number(a.overdue_amount ?? 0));
    if (sort === 'days') sorted.sort((a, b) => Number(b.max_days_overdue ?? 0) - Number(a.max_days_overdue ?? 0));
    if (sort === 'risk') sorted.sort((a, b) => Number(b.risk_score ?? 0) - Number(a.risk_score ?? 0));
    if (sort === 'name') sorted.sort((a, b) => (a.customer_name ?? '').localeCompare(b.customer_name ?? ''));
    return sorted;
  }, [cases, statusFilter, q, sort]);

  const buckets = [
    { label: 'Heute fällig', key: 'due_today' },
    { label: '1–7 Tage', key: 'bucket_1_7' },
    { label: '8–14 Tage', key: 'bucket_8_14' },
    { label: '15–30 Tage', key: 'bucket_15_30' },
    { label: '31–60 Tage', key: 'bucket_31_60' },
    { label: '> 60 Tage', key: 'bucket_60_plus' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="ALIX COLLECT"
        subtitle="Intelligentes Forderungsmanagement · Mahnwesen · Eskalation"
        icon={AlertTriangle}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => run('collect-engine', 'Fälle aktualisieren')}>
              <RefreshCw className={`h-4 w-4 mr-2 ${busy === 'collect-engine' ? 'animate-spin' : ''}`} />
              Fälle aktualisieren
            </Button>
            <Button size="sm" disabled={busy !== null} onClick={() => run('collect-ai-score', 'KI-Bewertung')}>
              <Sparkles className={`h-4 w-4 mr-2 ${busy === 'collect-ai-score' ? 'animate-pulse' : ''}`} />
              KI-Bewertung
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Offene Forderungen" value={fmt(kpis?.open_total)} icon={Wallet} />
        <Kpi label="Überfällig" value={fmt(kpis?.overdue_total)} icon={AlertTriangle} tone="text-red-400" />
        <Kpi label="Zahlungseingang heute" value={fmt(kpis?.incoming_today)} icon={TrendingUp} tone="text-emerald-400" />
        <Kpi label="DSO / Ø Zahlungsdauer" value={`${kpis?.dso ?? 0} / ${kpis?.avg_payment_days ?? 0} Tage`} icon={Clock} />
      </div>

      <DataCard title="Altersstruktur (Aging)">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {buckets.map((b) => (
            <div key={b.key} className="rounded-lg border border-border p-3">
              <div className="text-xs text-muted-foreground">{b.label}</div>
              <div className="font-display text-lg font-semibold">{fmt(kpis?.[b.key])}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Kpi label={`Inkasso (${kpis?.cases_inkasso ?? 0})`} value={fmt(kpis?.amount_inkasso)} icon={Gavel} tone="text-orange-400" />
          <Kpi label={`Anwalt (${kpis?.cases_anwalt ?? 0})`} value={fmt(kpis?.amount_anwalt)} icon={Scale} tone="text-red-400" />
          <Kpi label={`Insolvenz (${kpis?.cases_insolvenz ?? 0})`} value={fmt(kpis?.amount_insolvenz)} icon={Ban} />
        </div>
      </DataCard>

      <DataCard
        title={`Forderungsfälle (${filtered.length})`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kunde suchen" className="h-8 w-48 pl-7" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="offen">Offene Fälle</SelectItem>
                <SelectItem value="alle">Alle</SelectItem>
                <SelectItem value="payment_plan">Ratenplan</SelectItem>
                <SelectItem value="inkasso">Inkasso</SelectItem>
                <SelectItem value="anwalt">Anwalt</SelectItem>
                <SelectItem value="insolvenz">Insolvenz</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="probability">Zahlt heute wahrscheinlich</SelectItem>
                <SelectItem value="overdue">Höchste Forderung</SelectItem>
                <SelectItem value="days">Längster Verzug</SelectItem>
                <SelectItem value="risk">Höchstes Risiko</SelectItem>
                <SelectItem value="name">Kundenname</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      >
        {loading ? (
          <SkeletonTable />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title="Keine Forderungsfälle"
            description="Starte „Fälle aktualisieren“, um offene Rechnungen einzulesen."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="py-2 text-left font-medium">Prio</th>
                  <th className="py-2 text-left font-medium">Kunde</th>
                  <th className="py-2 text-left font-medium">Stufe</th>
                  <th className="py-2 text-right font-medium">Verzug</th>
                  <th className="py-2 text-right font-medium">Überfällig</th>
                  <th className="py-2 text-right font-medium">Offen gesamt</th>
                  <th className="py-2 text-right font-medium">Zahlungs-W.</th>
                  <th className="py-2 text-left font-medium">Empfehlung</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const p = Number(r.pay_probability_pct ?? 0);
                  const stars = p >= 90 ? 5 : p >= 75 ? 4 : p >= 50 ? 3 : p >= 25 ? 2 : 1;
                  const rec = p >= 90 ? 'Anrufen nicht notwendig' : p >= 75 ? 'E-Mail ausreichend' : p >= 25 ? 'Telefon empfohlen' : 'Direkt Anwalt / Inkasso';
                  return (
                  <tr key={r.id} className={`border-b border-border/50 ${i % 2 ? 'bg-muted/20' : ''}`}>
                    <td className="py-2 text-amber-400" title={`${p}%`}>{'★'.repeat(stars)}<span className="text-muted-foreground/40">{'★'.repeat(5 - stars)}</span></td>
                    <td className="py-2">
                      <Link to={`/finance/collect/${r.id}`} className="font-medium text-primary hover:underline">
                        {r.customer_name ?? '–'}
                      </Link>
                      <TenantBadge tenantId={r.tenant_id} className="ml-2 align-middle" />
                      {r.risk_class && (
                        <span className={`ml-2 text-xs ${RISK[r.risk_class] ?? ''}`}>{r.risk_class}</span>
                      )}
                    </td>
                    <td className="py-2">
                      <Badge variant="outline" className={AMPEL[r.ampel ?? 'gruen']}>{r.stage_code ?? '–'}</Badge>
                      {r.status && !['active', 'closed'].includes(r.status) && (
                        <Badge variant="outline" className="ml-1">{r.status}</Badge>
                      )}
                    </td>
                    <td className="py-2 text-right">{r.max_days_overdue ?? 0} T</td>
                    <td className="py-2 text-right text-red-400">{fmt(r.overdue_amount, r.currency ?? 'EUR')}</td>
                    <td className="py-2 text-right">{fmt(r.open_amount, r.currency ?? 'EUR')}</td>
                    <td className="py-2 text-right">{r.pay_probability_pct != null ? `${r.pay_probability_pct}%` : '–'}</td>
                    <td className="py-2 text-muted-foreground">{r.next_action ?? rec}</td>
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
