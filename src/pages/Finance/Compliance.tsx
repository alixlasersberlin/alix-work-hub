import { useEffect, useState } from 'react';
import { ShieldCheck, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, PageLoading, DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

const MODULES = [
  'finance_incoming_invoices', 'finance_approvals', 'finance_sepa_runs',
  'finance_reminders', 'finance_transactions', 'finance_year_end_runs',
  'finance_bank_statements', 'finance_automations',
];

export default function FinanceCompliance() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('audit_logs' as any)
      .select('created_at, user_id, action, module, record_id, details')
      .in('module', MODULES)
      .gte('created_at', from + 'T00:00:00')
      .lte('created_at', to + 'T23:59:59')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    setLogs((data ?? []) as any[]);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [from, to]);

  const exportCsv = async () => {
    setBusy(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/finance-compliance-report?from=${from}T00:00:00Z&to=${to}T23:59:59Z`;
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(url, { headers: { Authorization: `Bearer ${session?.access_token}` } });
      if (!res.ok) throw new Error('Export fehlgeschlagen');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `compliance_${from}_${to}.csv`;
      a.click();
      toast({ title: 'Export erstellt' });
    } catch (e: any) {
      toast({ title: 'Fehler', description: e.message, variant: 'destructive' });
    }
    setBusy(false);
  };

  if (loading) return <PageLoading />;

  return (
    <div className="space-y-6">
      <PageHeader title="Finance Compliance" subtitle="Audit-Trail für GoBD / ISO 13485" icon={ShieldCheck}>
        <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-40" />
        <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-40" />
        <Button onClick={exportCsv} disabled={busy}><Download className="h-4 w-4 mr-2" />CSV-Export</Button>
      </PageHeader>

      <DataCard title={`${logs.length} Einträge (max. 500 angezeigt)`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/40 text-muted-foreground">
              <tr>
                <th className="text-left p-2">Zeit</th>
                <th className="text-left p-2">Aktion</th>
                <th className="text-left p-2">Modul</th>
                <th className="text-left p-2">Datensatz</th>
                <th className="text-left p-2">User</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l, i) => (
                <tr key={i} className="border-b border-border/20">
                  <td className="p-2 text-xs">{new Date(l.created_at).toLocaleString('de-DE')}</td>
                  <td className="p-2"><Badge variant="outline">{l.action}</Badge></td>
                  <td className="p-2 text-xs">{l.module}</td>
                  <td className="p-2 text-xs font-mono">{l.record_id?.slice(0, 12) ?? '–'}</td>
                  <td className="p-2 text-xs font-mono">{l.user_id?.slice(0, 8) ?? 'system'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && <div className="text-sm text-muted-foreground p-8 text-center">Keine Einträge im Zeitraum</div>}
        </div>
      </DataCard>
    </div>
  );
}
