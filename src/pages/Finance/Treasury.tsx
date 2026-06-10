import { useEffect, useState } from 'react';
import { Landmark, Plus, Check, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, PageLoading, DataCard, PageEmpty } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

type Tenant = { id: string; name: string; flag_emoji?: string };

export default function FinanceTreasury() {
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [liquidity, setLiquidity] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);

  const [newAcc, setNewAcc] = useState({ tenant_id: '', account_name: '', bank_name: '', iban: '', currency: 'EUR' });
  const [newApr, setNewApr] = useState({ payee_name: '', amount: '', purpose: '', due_date: '' });

  const tname = (id: string | null) => {
    const t = tenants.find((x) => x.id === id);
    return t ? `${t.flag_emoji ?? ''} ${t.name}`.trim() : '–';
  };
  const fmt = (n: number, c = 'EUR') =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: c }).format(Number(n ?? 0));

  const load = async () => {
    setLoading(true);
    const [{ data: t }, { data: a }, { data: l }, { data: p }] = await Promise.all([
      supabase.from('tenants' as any).select('id,name,flag_emoji').eq('is_active', true).order('sort_order'),
      supabase.from('finance_bank_accounts' as any).select('*').order('created_at', { ascending: false }),
      supabase.from('finance_liquidity_entries' as any).select('*').order('entry_date', { ascending: false }).limit(60),
      supabase.from('finance_payment_approvals' as any).select('*').order('created_at', { ascending: false }).limit(80),
    ]);
    setTenants((t ?? []) as any);
    setAccounts((a ?? []) as any);
    setLiquidity((l ?? []) as any);
    setApprovals((p ?? []) as any);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const addAccount = async () => {
    if (!newAcc.account_name) return toast({ title: 'Kontoname fehlt', variant: 'destructive' });
    const { error } = await supabase.from('finance_bank_accounts' as any).insert({
      tenant_id: newAcc.tenant_id || null,
      account_name: newAcc.account_name,
      bank_name: newAcc.bank_name || null,
      iban: newAcc.iban || null,
      currency: newAcc.currency || 'EUR',
    });
    if (error) toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    else { setNewAcc({ tenant_id: '', account_name: '', bank_name: '', iban: '', currency: 'EUR' }); load(); }
  };

  const requestApproval = async () => {
    if (!newApr.payee_name || !newApr.amount) return toast({ title: 'Empfänger & Betrag erforderlich', variant: 'destructive' });
    const { error } = await supabase.from('finance_payment_approvals' as any).insert({
      payee_name: newApr.payee_name,
      amount: Number(newApr.amount),
      purpose: newApr.purpose || null,
      due_date: newApr.due_date || null,
      status: 'pending',
    });
    if (error) toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    else { setNewApr({ payee_name: '', amount: '', purpose: '', due_date: '' }); load(); }
  };

  const decide = async (id: string, decision: 'approved' | 'rejected') => {
    const patch: any = { status: decision };
    if (decision === 'approved') patch.approved_at = new Date().toISOString();
    const { error } = await supabase.from('finance_payment_approvals' as any).update(patch).eq('id', id);
    if (error) toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    else load();
  };

  if (loading) return <PageLoading />;

  const totalBalance = accounts.reduce((s, a) => s + Number(a.current_balance ?? 0), 0);

  return (
    <div className="space-y-6 container mx-auto px-4 py-8">
      <PageHeader
        title="Treasury & Cash-Management"
        subtitle={`${accounts.length} Bankkonten · Gesamtsaldo ${fmt(totalBalance)}`}
        icon={Landmark}
      />

      <Tabs defaultValue="accounts">
        <TabsList>
          <TabsTrigger value="accounts">Bankkonten</TabsTrigger>
          <TabsTrigger value="liquidity">Liquiditätsdisposition</TabsTrigger>
          <TabsTrigger value="approvals">Zahlungsfreigaben</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-4">
          <DataCard title="Neues Bankkonto">
            <div className="p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
              <select
                value={newAcc.tenant_id}
                onChange={(e) => setNewAcc({ ...newAcc, tenant_id: e.target.value })}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Mandant…</option>
                {tenants.map((t) => <option key={t.id} value={t.id}>{tname(t.id)}</option>)}
              </select>
              <Input placeholder="Kontoname" value={newAcc.account_name}
                onChange={(e) => setNewAcc({ ...newAcc, account_name: e.target.value })} />
              <Input placeholder="Bank" value={newAcc.bank_name}
                onChange={(e) => setNewAcc({ ...newAcc, bank_name: e.target.value })} />
              <Input placeholder="IBAN" value={newAcc.iban}
                onChange={(e) => setNewAcc({ ...newAcc, iban: e.target.value })} />
              <Button onClick={addAccount}><Plus className="w-4 h-4 mr-1.5" />Anlegen</Button>
            </div>
          </DataCard>

          {accounts.length === 0 ? <PageEmpty message="Noch keine Konten." /> : (
            <DataCard title={`${accounts.length} Konten`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/40 text-muted-foreground">
                    <tr>
                      <th className="text-left p-3">Mandant</th>
                      <th className="text-left p-3">Konto</th>
                      <th className="text-left p-3">Bank</th>
                      <th className="text-left p-3">IBAN</th>
                      <th className="text-right p-3">Saldo</th>
                      <th className="text-right p-3">Verfügbar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((a) => (
                      <tr key={a.id} className="border-b border-border/20">
                        <td className="p-3">{tname(a.tenant_id)}</td>
                        <td className="p-3 font-medium">{a.account_name}</td>
                        <td className="p-3">{a.bank_name ?? '–'}</td>
                        <td className="p-3 text-xs">{a.iban ?? '–'}</td>
                        <td className="p-3 text-right">{fmt(a.current_balance, a.currency)}</td>
                        <td className="p-3 text-right">{fmt(a.available_balance, a.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DataCard>
          )}
        </TabsContent>

        <TabsContent value="liquidity" className="space-y-4">
          <DataCard title="Tägliche Liquiditätsdisposition (letzte 60 Einträge)">
            {liquidity.length === 0 ? <PageEmpty message="Keine Einträge erfasst." /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/40 text-muted-foreground">
                    <tr>
                      <th className="text-left p-3">Datum</th>
                      <th className="text-left p-3">Konto</th>
                      <th className="text-right p-3">Eröffnung</th>
                      <th className="text-right p-3">Zufluss</th>
                      <th className="text-right p-3">Abfluss</th>
                      <th className="text-right p-3">Schluss</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liquidity.map((e) => {
                      const acc = accounts.find((a) => a.id === e.bank_account_id);
                      return (
                        <tr key={e.id} className="border-b border-border/20">
                          <td className="p-3">{e.entry_date}</td>
                          <td className="p-3">{acc?.account_name ?? '–'}</td>
                          <td className="p-3 text-right">{fmt(e.opening_balance, e.currency)}</td>
                          <td className="p-3 text-right text-emerald-500">{fmt(e.expected_inflow, e.currency)}</td>
                          <td className="p-3 text-right text-rose-500">{fmt(e.expected_outflow, e.currency)}</td>
                          <td className="p-3 text-right font-medium">{fmt(e.closing_balance, e.currency)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </DataCard>
        </TabsContent>

        <TabsContent value="approvals" className="space-y-4">
          <DataCard title="Neue Zahlungsfreigabe beantragen">
            <div className="p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
              <Input placeholder="Empfänger" value={newApr.payee_name}
                onChange={(e) => setNewApr({ ...newApr, payee_name: e.target.value })} />
              <Input type="number" placeholder="Betrag" value={newApr.amount}
                onChange={(e) => setNewApr({ ...newApr, amount: e.target.value })} />
              <Input placeholder="Verwendungszweck" value={newApr.purpose}
                onChange={(e) => setNewApr({ ...newApr, purpose: e.target.value })} />
              <Input type="date" value={newApr.due_date}
                onChange={(e) => setNewApr({ ...newApr, due_date: e.target.value })} />
              <Button onClick={requestApproval}><Plus className="w-4 h-4 mr-1.5" />Beantragen</Button>
            </div>
          </DataCard>

          {approvals.length === 0 ? <PageEmpty message="Keine offenen Freigaben." /> : (
            <DataCard title={`${approvals.length} Anträge`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/40 text-muted-foreground">
                    <tr>
                      <th className="text-left p-3">Empfänger</th>
                      <th className="text-right p-3">Betrag</th>
                      <th className="text-left p-3">Zweck</th>
                      <th className="text-left p-3">Fällig</th>
                      <th className="text-center p-3">Status</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvals.map((a) => (
                      <tr key={a.id} className="border-b border-border/20">
                        <td className="p-3 font-medium">{a.payee_name}</td>
                        <td className="p-3 text-right">{fmt(a.amount, a.currency)}</td>
                        <td className="p-3 text-muted-foreground">{a.purpose ?? '–'}</td>
                        <td className="p-3">{a.due_date ?? '–'}</td>
                        <td className="p-3 text-center">
                          <Badge variant={a.status === 'approved' ? 'default' : a.status === 'rejected' ? 'destructive' : 'outline'}>
                            {a.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-right">
                          {a.status === 'pending' && (
                            <div className="flex gap-1 justify-end">
                              <Button size="sm" variant="outline" onClick={() => decide(a.id, 'approved')}>
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => decide(a.id, 'rejected')}>
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DataCard>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
