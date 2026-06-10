import { useEffect, useState } from 'react';
import { Banknote, AlertTriangle, FileText, Wallet, ScrollText, ArrowDownToLine } from 'lucide-react';
import { PageHeader } from '@/components/PageShell';
import { supabase } from '@/integrations/supabase/client';

interface Kpi { label: string; value: string; icon: any; tone?: string; }

export default function FinanceDashboard() {
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const fmt = (n: number) => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
      const [accountsRes, contractsRes, txRes] = await Promise.all([
        supabase.from('finance_accounts' as any).select('current_balance, overdue_balance'),
        supabase.from('finance_contracts' as any).select('id, status, monthly_rate, remaining_amount').eq('status', 'aktiv'),
        supabase.from('finance_transactions' as any).select('amount, transaction_type'),
      ]);
      const accounts = (accountsRes.data ?? []) as any[];
      const contracts = (contractsRes.data ?? []) as any[];
      const tx = (txRes.data ?? []) as any[];
      const open = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);
      const overdue = accounts.reduce((s, a) => s + Number(a.overdue_balance || 0), 0);
      const deposits = tx.filter(t => t.transaction_type === 'Anzahlung').reduce((s, t) => s + Number(t.amount || 0), 0);
      const payments = tx.filter(t => t.transaction_type === 'Zahlung').reduce((s, t) => s + Number(t.amount || 0), 0);
      const monthlyRates = contracts.reduce((s, c) => s + Number(c.monthly_rate || 0), 0);
      setKpis([
        { label: 'Offene Forderungen', value: fmt(open), icon: Banknote },
        { label: 'Überfällige Forderungen', value: fmt(overdue), icon: AlertTriangle, tone: 'text-destructive' },
        { label: 'Offene Anzahlungen', value: fmt(deposits), icon: Wallet },
        { label: 'Aktive Verträge', value: String(contracts.length), icon: FileText },
        { label: 'Offene Raten (monatlich)', value: fmt(monthlyRates), icon: ScrollText },
        { label: 'Zahlungseingänge', value: fmt(payments), icon: ArrowDownToLine, tone: 'text-success' },
      ]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader icon={<Banknote className="w-6 h-6 text-primary" />} title="Finance Dashboard" subtitle="Übersicht über Forderungen, Verträge und Zahlungen" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="rounded-xl border border-border bg-card p-5 card-glow">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <Icon className={`w-4 h-4 ${k.tone || 'text-primary'}`} />
              </div>
              <p className={`text-2xl font-display font-bold ${k.tone || 'text-foreground'}`}>{loading ? '—' : k.value}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
