import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, PlayCircle, RefreshCw, Settings as SettingsIcon, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, PageLoading, DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

type AccRow = {
  id: string;
  customer_id: string;
  reminder_level: number | null;
  overdue_balance: number | null;
  last_reminder_at: string | null;
  customers: { company_name: string | null; contact_name: string | null; email: string | null } | null;
};

type DraftRow = { id: string; customer_id: string; level: number; total: number; status: string; created_at: string };

const LEVEL_LABEL = ['—', 'Zahlungserinnerung', '1. Mahnung', '2. Mahnung', 'Letzte Mahnung'];

const fmt = (n: number | null) => typeof n === 'number'
  ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n) : '–';

export default function FinanceMahnwesen() {
  const { roles } = useAuth();
  const isSuperAdmin = roles.includes('Super Admin');
  const [accounts, setAccounts] = useState<AccRow[]>([]);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    const [accRes, draftRes] = await Promise.all([
      supabase.from('finance_accounts' as any)
        .select('id, customer_id, reminder_level, overdue_balance, last_reminder_at, customers(company_name, contact_name, email)')
        .gt('overdue_balance', 0)
        .order('overdue_balance', { ascending: false })
        .limit(500),
      supabase.from('finance_reminders' as any)
        .select('id, customer_id, level, total, status, created_at')
        .eq('status', 'Entwurf')
        .order('created_at', { ascending: false }),
    ]);
    setAccounts(((accRes.data ?? []) as any) as AccRow[]);
    setDrafts(((draftRes.data ?? []) as any) as DraftRow[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const runEngine = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('finance-reminder-engine', { body: {} });
      if (error) throw error;
      toast({ title: 'Mahn-Engine ausgeführt', description: `Konten: ${data?.accounts_seen ?? 0} • Entwürfe erstellt: ${data?.drafts_created ?? 0} • übersprungen: ${data?.skipped ?? 0}` });
      await load();
    } catch (e: any) {
      toast({ title: 'Fehler', description: e?.message ?? 'Unbekannt', variant: 'destructive' });
    } finally { setRunning(false); }
  };

  const draftsByCustomer = new Map(drafts.map(d => [d.customer_id, d]));

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        icon={<AlertTriangle className="w-6 h-6 text-amber-500" />}
        title="Mahnwesen"
        subtitle="Überfällige Forderungen, automatische Stufenfindung & manueller Versand"
        actions={
          <div className="flex gap-2">
            <Link to="/finance/mahnwesen/einstellungen">
              <Button variant="outline" size="sm"><SettingsIcon className="w-4 h-4 mr-2" />Einstellungen</Button>
            </Link>
            <Button onClick={runEngine} disabled={running} className="gold-gradient text-primary-foreground">
              {running ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-2" />}
              {running ? 'Lauf läuft…' : 'Mahn-Engine starten'}
            </Button>
          </div>
        }
      />

      {loading ? <PageLoading /> : (
        <DataCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Kunde</th>
                  <th className="text-left px-4 py-3 font-medium">E-Mail</th>
                  <th className="text-left px-4 py-3 font-medium">Aktuelle Stufe</th>
                  <th className="text-right px-4 py-3 font-medium">Überfällig</th>
                  <th className="text-left px-4 py-3 font-medium">Letzte Mahnung</th>
                  <th className="text-left px-4 py-3 font-medium">Entwurf</th>
                  <th className="text-right px-4 py-3 font-medium">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {accounts.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">Keine überfälligen Forderungen.</td></tr>
                ) : accounts.map(a => {
                  const d = draftsByCustomer.get(a.customer_id);
                  return (
                    <tr key={a.id} className="border-t border-border hover:bg-muted/20">
                      <td className="px-4 py-3">{a.customers?.company_name || a.customers?.contact_name || a.customer_id.slice(0, 8)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{a.customers?.email ?? '–'}</td>
                      <td className="px-4 py-3"><Badge variant="outline">{LEVEL_LABEL[a.reminder_level ?? 0] ?? `Stufe ${a.reminder_level}`}</Badge></td>
                      <td className="px-4 py-3 text-right tabular-nums text-destructive">{fmt(a.overdue_balance)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{a.last_reminder_at ? new Date(a.last_reminder_at).toLocaleDateString('de-DE') : '–'}</td>
                      <td className="px-4 py-3">{d ? <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/30">Stufe {d.level} • {fmt(d.total)}</Badge> : '–'}</td>
                      <td className="px-4 py-3 text-right">
                        <Link to={`/finance/mahnwesen/${a.customer_id}`}>
                          <Button size="sm" variant="outline"><Eye className="w-3.5 h-3.5 mr-1" />Detail</Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DataCard>
      )}
    </div>
  );
}
