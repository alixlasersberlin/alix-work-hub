import { useEffect, useMemo, useState } from 'react';
import { Network, Plus, Trash2, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, PageLoading, DataCard, PageEmpty } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';

export default function FinanceIntercompany() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [rels, setRels] = useState<any[]>([]);
  const [unmatched, setUnmatched] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [label, setLabel] = useState('');

  const tenantName = useMemo(() => {
    const m: Record<string, string> = {};
    for (const t of tenants) m[t.id] = `${t.flag_emoji ?? ''} ${t.name}`.trim();
    return m;
  }, [tenants]);

  const load = async () => {
    setLoading(true);
    const [{ data: t }, { data: r }, { data: u }] = await Promise.all([
      supabase.from('tenants' as any).select('id,name,flag_emoji').eq('is_active', true).order('sort_order'),
      supabase.from('finance_intercompany_relations' as any).select('*').order('created_at', { ascending: false }),
      supabase
        .from('finance_transactions' as any)
        .select('id, tenant_id, counterparty_tenant_id, amount, currency, booking_date, transaction_type, reference')
        .eq('is_intercompany', true)
        .order('booking_date', { ascending: false })
        .limit(50),
    ]);
    setTenants((t ?? []) as any[]);
    setRels((r ?? []) as any[]);
    setUnmatched((u ?? []) as any[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const addRelation = async () => {
    if (!source || !target || source === target) {
      toast({ title: 'Bitte zwei unterschiedliche Mandanten wählen', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('finance_intercompany_relations' as any).insert({
      source_tenant_id: source, target_tenant_id: target, label: label || null,
    });
    if (error) toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    else { setLabel(''); await load(); }
  };

  const toggleActive = async (id: string, active: boolean) => {
    const { error } = await supabase.from('finance_intercompany_relations' as any).update({ active }).eq('id', id);
    if (error) toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    else await load();
  };

  const removeRelation = async (id: string) => {
    const { error } = await supabase.from('finance_intercompany_relations' as any).delete().eq('id', id);
    if (error) toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    else await load();
  };

  if (loading) return <PageLoading />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Intercompany"
        subtitle="Mandanten-Beziehungen und intercompany-markierte Buchungen"
        icon={Network}
      />

      <DataCard title="Neue Beziehung anlegen">
        <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Quelle</label>
            <select value={source} onChange={(e) => setSource(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Mandant wählen…</option>
              {tenants.map((t) => <option key={t.id} value={t.id}>{tenantName[t.id]}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Ziel</label>
            <select value={target} onChange={(e) => setTarget(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Mandant wählen…</option>
              {tenants.map((t) => <option key={t.id} value={t.id}>{tenantName[t.id]}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Bezeichnung</label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="z. B. Verrechnung DE→AT" />
          </div>
          <Button onClick={addRelation}><Plus className="h-4 w-4 mr-1.5" />Anlegen</Button>
        </div>
      </DataCard>

      <DataCard title={`${rels.length} Beziehungen`}>
        {rels.length === 0 ? (
          <PageEmpty message="Noch keine Beziehungen definiert." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/40 text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Quelle</th>
                  <th className="text-left p-3">Ziel</th>
                  <th className="text-left p-3">Bezeichnung</th>
                  <th className="text-center p-3">Aktiv</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {rels.map((r) => (
                  <tr key={r.id} className="border-b border-border/20">
                    <td className="p-3">{tenantName[r.source_tenant_id] ?? r.source_tenant_id}</td>
                    <td className="p-3">{tenantName[r.target_tenant_id] ?? r.target_tenant_id}</td>
                    <td className="p-3 text-muted-foreground">{r.label ?? '–'}</td>
                    <td className="p-3 text-center">
                      <Switch checked={r.active} onCheckedChange={(v) => toggleActive(r.id, v)} />
                    </td>
                    <td className="p-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => removeRelation(r.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>

      <DataCard title={`${unmatched.length} Intercompany-Buchungen (letzte 50)`}>
        {unmatched.length === 0 ? (
          <PageEmpty message="Keine als Intercompany markierten Buchungen." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/40 text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Datum</th>
                  <th className="text-left p-3">Mandant</th>
                  <th className="text-left p-3">Gegenmandant</th>
                  <th className="text-left p-3">Art</th>
                  <th className="text-left p-3">Referenz</th>
                  <th className="text-right p-3">Betrag</th>
                </tr>
              </thead>
              <tbody>
                {unmatched.map((t) => (
                  <tr key={t.id} className="border-b border-border/20">
                    <td className="p-3">{t.booking_date}</td>
                    <td className="p-3">{tenantName[t.tenant_id] ?? '–'}</td>
                    <td className="p-3">{tenantName[t.counterparty_tenant_id] ?? '–'}</td>
                    <td className="p-3">{t.transaction_type ?? '–'}</td>
                    <td className="p-3 text-xs">{t.reference ?? '–'}</td>
                    <td className="p-3 text-right">
                      {new Intl.NumberFormat('de-DE', { style: 'currency', currency: t.currency || 'EUR' })
                        .format(Number(t.amount ?? 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>
    </div>
  );
}
