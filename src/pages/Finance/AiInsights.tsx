import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, PageLoading, DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { classifyTx, mapIncomingCategory, BUDGET_CATEGORIES } from './_controlling';

export default function FinanceAiInsights() {
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<'cockpit' | 'bwa' | 'soll_ist' | 'forecast'>('cockpit');
  const [generating, setGenerating] = useState(false);
  const [insights, setInsights] = useState<any[]>([]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('finance_ai_insights' as any).select('*').order('created_at', { ascending: false }).limit(50);
    setInsights((data as any[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function generate() {
    setGenerating(true);
    try {
      const year = new Date().getFullYear();
      const s = `${year}-01-01`, e = new Date().toISOString().slice(0, 10);
      const [{ data: tx }, { data: ii }, { data: acc }] = await Promise.all([
        supabase.from('finance_transactions').select('amount, transaction_type, booking_date').gte('booking_date', s).lte('booking_date', e),
        supabase.from('finance_incoming_invoices').select('amount_gross, invoice_date, paid_at, description').gte('invoice_date', s).lte('invoice_date', e),
        supabase.from('finance_accounts').select('current_balance, overdue_balance'),
      ]);
      const byCat: Record<string, number> = {};
      for (const c of BUDGET_CATEGORIES) byCat[c] = 0;
      for (const r of tx ?? []) { const c = classifyTx(r as any); if (c) byCat[c] += Math.abs(Number((r as any).amount) || 0); }
      for (const r of ii ?? []) { byCat[mapIncomingCategory((r as any).description)] += Number((r as any).amount_gross) || 0; }
      const openSum = (acc ?? []).reduce((s, a: any) => s + Number(a.current_balance || 0), 0);
      const overdueSum = (acc ?? []).reduce((s, a: any) => s + Number(a.overdue_balance || 0), 0);

      const { data, error } = await supabase.functions.invoke('finance-ai-analyze', {
        body: {
          scope, period_start: s, period_end: e,
          kpis: { kategorien: byCat, offene_posten_eur: openSum, overdue_eur: overdueSum, anzahl_transaktionen: tx?.length ?? 0 },
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success('KI-Analyse erstellt');
      await load();
    } catch (e: any) {
      toast.error(e.message || 'Fehler');
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <PageLoading />;

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="KI-Finanzanalyse" subtitle="Automatische Erklärungen zu Cockpit, BWA, Soll-Ist & Forecast" />
      <div className="flex items-center gap-3">
        <Select value={scope} onValueChange={(v: any) => setScope(v)}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="cockpit">Cockpit</SelectItem>
            <SelectItem value="bwa">BWA</SelectItem>
            <SelectItem value="soll_ist">Soll-Ist</SelectItem>
            <SelectItem value="forecast">Forecast</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={generate} disabled={generating}>
          {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          KI-Analyse generieren
        </Button>
      </div>

      <div className="space-y-4">
        {insights.length === 0 && <DataCard title="Noch keine Analysen"><p className="text-sm text-muted-foreground">Klicke auf „KI-Analyse generieren".</p></DataCard>}
        {insights.map(ins => (
          <DataCard key={ins.id} title={`${ins.scope.toUpperCase()} · ${new Date(ins.created_at).toLocaleString('de-DE')}`}>
            <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">{ins.response}</pre>
          </DataCard>
        ))}
      </div>
    </div>
  );
}
