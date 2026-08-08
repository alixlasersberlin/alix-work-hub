import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, Download, RefreshCw, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, PageLoading, PageError } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KpiSection, FunnelSection, AgeSection } from '@/components/sales/analyse/OverviewSections';
import {
  ProductSection, LossSection, CompetitorSection, FinancingSection, LeadSection,
  RepSection, HeatmapSection, MapSection,
} from '@/components/sales/analyse/BreakdownSections';
import { FollowupSection, ForecastSection, AiSection, ExecutiveSection } from '@/components/sales/analyse/FollowupSections';
import { TrendSection } from '@/components/sales/analyse/TrendSection';
import {
  computeReps, eur, isLost, isOpen, isWon, offerValue, productOf, stageOf, STAGES, type OfferRow,
} from '@/lib/sales/offer-analytics';

const RANGES = [
  { code: '30', label: '30 Tage' },
  { code: '90', label: '90 Tage' },
  { code: '365', label: '12 Monate' },
  { code: 'all', label: 'Alle' },
];

const OUTCOMES = [
  { code: '', label: 'Alle Status' },
  { code: 'open', label: 'Offen' },
  { code: 'won', label: 'Gewonnen' },
  { code: 'lost', label: 'Verloren' },
];

const PREFS_KEY = 'angebotsanalyse.prefs.v1';

type Prefs = { range: string; rep: string; stage: string; outcome: string; tab: string };

const DEFAULT_PREFS: Prefs = { range: '365', rep: '', stage: '', outcome: '', tab: 'uebersicht' };

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export default function Angebotsanalyse() {
  const initial = useMemo(loadPrefs, []);
  const [rows, setRows] = useState<OfferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState(initial.range);
  const [rep, setRep] = useState(initial.rep);
  const [stage, setStage] = useState(initial.stage);
  const [outcome, setOutcome] = useState(initial.outcome);
  const [tab, setTab] = useState(initial.tab);
  const [q, setQ] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ range, rep, stage, outcome, tab }));
    } catch { /* ignore */ }
  }, [range, rep, stage, outcome, tab]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    let query = (supabase.from('offers') as any).select('*').order('offer_date', { ascending: false }).limit(5000);
    if (range !== 'all') {
      const since = new Date(Date.now() - Number(range) * 86_400_000).toISOString().slice(0, 10);
      query = query.gte('offer_date', since);
    }
    const { data, error: err } = await query;
    if (err) setError(err.message);
    setRows((data ?? []) as OfferRow[]);
    setLoading(false);
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const offers = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((o) => {
      if (rep && (o.created_by_name || 'Unbekannt') !== rep) return false;
      if (stage && stageOf(o) !== stage) return false;
      if (outcome === 'open' && !isOpen(o)) return false;
      if (outcome === 'won' && !isWon(o)) return false;
      if (outcome === 'lost' && !isLost(o)) return false;
      if (!term) return true;
      return [o.offer_number, o.customer_name, o.competitor, o.lead_source, productOf(o)]
        .some((v) => String(v ?? '').toLowerCase().includes(term));
    });
  }, [rows, rep, stage, outcome, q]);

  const reps = useMemo(() => computeReps(rows).map((r) => r.name), [rows]);
  const filtersActive = Boolean(rep || stage || outcome || q);
  const resetFilters = () => { setRep(''); setStage(''); setOutcome(''); setQ(''); };


  const exportCsv = () => {
    const head = ['Angebot', 'Datum', 'Kunde', 'Verkäufer', 'Phase', 'Produkt', 'Wert', 'Status', 'Lead', 'Finanzierung', 'Wettbewerber', 'Verlustgrund'];
    const lines = offers.map((o) => [
      o.offer_number, o.offer_date, o.customer_name, o.created_by_name, stageOf(o), productOf(o),
      offerValue(o).toFixed(2), o.status, o.lead_source, o.financing_type, o.competitor, o.loss_reason,
    ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';'));
    const blob = new Blob(['\ufeff' + [head.join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `angebotsanalyse-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <PageHeader
        icon={BarChart3}
        title="Angebotsanalyse"
        subtitle={`Vertriebs-Cockpit · ${offers.length} Angebote · Pipeline ${eur(offers.reduce((s, o) => s + offerValue(o), 0))}`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />CSV</Button>
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-2" />Aktualisieren</Button>
          </>
        }
      />

      <div className="sticky top-0 z-10 -mx-6 px-6 py-2 mb-5 bg-background/85 backdrop-blur border-b border-border/60">
        <div className="flex flex-wrap items-center gap-2">
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={range} onChange={(e) => setRange(e.target.value)}>
            {RANGES.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
          </select>
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={rep} onChange={(e) => setRep(e.target.value)}>
            <option value="">Alle Verkäufer</option>
            {reps.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="">Alle Phasen</option>
            {STAGES.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
          </select>
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            {OUTCOMES.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
          </select>
          <Input placeholder="Suche Kunde, Angebot, Produkt…" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 w-64" />
          {filtersActive && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <X className="h-4 w-4 mr-1" />Filter zurücksetzen
            </Button>
          )}
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {offers.length} von {rows.length} Angeboten
          </span>
        </div>
      </div>

      {error && <PageError message={error} onRetry={load} />}
      {loading ? (
        <PageLoading />
      ) : (
        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="uebersicht">Übersicht</TabsTrigger>
            <TabsTrigger value="verlauf">Verlauf</TabsTrigger>
            <TabsTrigger value="funnel">Funnel & Alter</TabsTrigger>

            <TabsTrigger value="verkaeufer">Verkäufer</TabsTrigger>
            <TabsTrigger value="produkte">Produkte</TabsTrigger>
            <TabsTrigger value="verluste">Verluste & Konkurrenz</TabsTrigger>
            <TabsTrigger value="quellen">Leads & Finanzierung</TabsTrigger>
            <TabsTrigger value="nachfassen">Nachfassen</TabsTrigger>
            <TabsTrigger value="ki">KI & Forecast</TabsTrigger>
            <TabsTrigger value="region">Region & Zeiten</TabsTrigger>
            <TabsTrigger value="gf">GF-Cockpit</TabsTrigger>
          </TabsList>

          <TabsContent value="uebersicht" className="space-y-4">
            <KpiSection offers={offers} />
            <TrendSection offers={offers} />
            <FunnelSection offers={offers} />
          </TabsContent>
          <TabsContent value="verlauf" className="space-y-4">
            <TrendSection offers={offers} />
            <AgeSection offers={offers} />
          </TabsContent>

          <TabsContent value="funnel" className="space-y-4">
            <FunnelSection offers={offers} />
            <AgeSection offers={offers} />
          </TabsContent>
          <TabsContent value="verkaeufer"><RepSection offers={offers} /></TabsContent>
          <TabsContent value="produkte"><ProductSection offers={offers} /></TabsContent>
          <TabsContent value="verluste" className="space-y-4">
            <LossSection offers={offers} />
            <CompetitorSection offers={offers} />
          </TabsContent>
          <TabsContent value="quellen" className="space-y-4">
            <LeadSection offers={offers} />
            <FinancingSection offers={offers} />
          </TabsContent>
          <TabsContent value="nachfassen"><FollowupSection offers={offers} onRefresh={load} /></TabsContent>
          <TabsContent value="ki" className="space-y-4">
            <ForecastSection offers={offers} />
            <AiSection offers={offers} onRefresh={load} />
          </TabsContent>
          <TabsContent value="region" className="space-y-4">
            <MapSection offers={offers} />
            <HeatmapSection offers={offers} />
          </TabsContent>
          <TabsContent value="gf"><ExecutiveSection offers={offers} /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}
