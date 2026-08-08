import { useEffect, useMemo, useState } from 'react';
import { Ban, CheckCircle2, Gauge, Plus, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/infinity/PageHeader';
import { SkeletonTable } from '@/components/infinity/Skeleton';
import { EmptyState } from '@/components/infinity/EmptyState';

const fmt = (n: any) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(Number(n ?? 0));

const lightFor = (limit: number, used: number, unlimited: boolean) => {
  if (unlimited) return 'gruen';
  if (!limit) return 'rot';
  const q = used / limit;
  if (q >= 1) return 'rot';
  if (q >= 0.8) return 'gelb';
  return 'gruen';
};

const LIGHT_CLASS: Record<string, string> = {
  gruen: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  gelb: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  rot: 'bg-destructive/15 text-destructive border-destructive/30',
};

export default function FinanceCollectLimits() {
  const [rows, setRows] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');

  const [name, setName] = useState('');
  const [limit, setLimit] = useState('');

  const load = async () => {
    setLoading(true);
    const [l, c] = await Promise.all([
      supabase.from('collect_credit_limits' as any).select('*').order('updated_at', { ascending: false }).limit(500),
      supabase.from('collect_cases' as any).select('customer_id,customer_name,open_amount').limit(1000),
    ]);
    if (l.error) toast({ title: 'Laden fehlgeschlagen', description: l.error.message, variant: 'destructive' });
    setRows((l.data as any) ?? []);
    setCases((c.data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openByCustomer = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cases) {
      const key = (c.customer_id as string) || (c.customer_name as string) || '';
      if (!key) continue;
      m.set(key, (m.get(key) ?? 0) + Number(c.open_amount ?? 0));
    }
    return m;
  }, [cases]);

  const create = async () => {
    if (!name.trim()) { toast({ title: 'Kundenname fehlt', variant: 'destructive' }); return; }
    const value = limit ? Number(limit.replace(',', '.')) : 0;
    const { error } = await supabase.from('collect_credit_limits' as any).insert({
      customer_name: name.trim(),
      credit_limit: value,
      unlimited: false,
      used_amount: 0,
      traffic_light: lightFor(value, 0, false),
      blocked: false,
    });
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    setName(''); setLimit('');
    toast({ title: 'Kreditlimit angelegt' });
    load();
  };

  const patch = async (id: string, values: Record<string, any>) => {
    const { error } = await supabase.from('collect_credit_limits' as any).update({ ...values, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    load();
  };

  const syncUsage = async () => {
    setSyncing(true);
    let updated = 0;
    for (const r of rows) {
      const used = openByCustomer.get(r.customer_id) ?? openByCustomer.get(r.customer_name) ?? 0;
      const light = lightFor(Number(r.credit_limit ?? 0), used, !!r.unlimited);
      if (Number(r.used_amount ?? 0) === used && r.traffic_light === light) continue;
      const { error } = await supabase.from('collect_credit_limits' as any)
        .update({ used_amount: used, traffic_light: light, updated_at: new Date().toISOString() })
        .eq('id', r.id);
      if (!error) updated++;
    }
    setSyncing(false);
    toast({ title: 'Abgleich fertig', description: `${updated} Limits aktualisiert` });
    load();
  };

  const filtered = rows.filter((r) => !search || (r.customer_name ?? '').toLowerCase().includes(search.toLowerCase()));
  const blocked = rows.filter((r) => r.blocked).length;
  const totalLimit = rows.reduce((a, r) => a + (r.unlimited ? 0 : Number(r.credit_limit ?? 0)), 0);
  const totalUsed = rows.reduce((a, r) => a + Number(r.used_amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Kreditlimits & Sperren" subtitle="Limits, Ausnutzung, Ampel und Liefersperren je Kunde" icon={Gauge} />

      <div className="grid gap-4 md:grid-cols-4">
        <DataCard title="Kunden mit Limit"><div className="text-2xl font-semibold">{rows.length}</div></DataCard>
        <DataCard title="Summe Limits"><div className="text-2xl font-semibold">{fmt(totalLimit)}</div></DataCard>
        <DataCard title="Ausgenutzt"><div className="text-2xl font-semibold">{fmt(totalUsed)}</div></DataCard>
        <DataCard title="Gesperrt"><div className="text-2xl font-semibold text-destructive">{blocked}</div></DataCard>
      </div>

      <DataCard title="Neues Kreditlimit">
        <div className="flex flex-wrap items-center gap-2">
          <Input className="w-64" placeholder="Kundenname" value={name} onChange={(e) => setName(e.target.value)} />
          <Input className="w-40" placeholder="Limit (EUR)" value={limit} onChange={(e) => setLimit(e.target.value)} />
          <Button onClick={create}><Plus className="mr-2 h-4 w-4" />Anlegen</Button>
          <div className="flex-1" />
          <Button variant="outline" onClick={syncUsage} disabled={syncing || loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />Ausnutzung abgleichen
          </Button>
        </div>
      </DataCard>

      <DataCard title="Limits">
        <div className="mb-3">
          <Input className="w-72" placeholder="Kunde suchen…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {loading ? (
          <SkeletonTable rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Gauge} title="Keine Kreditlimits" description="Lege oben ein Limit für einen Kunden an." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-3">Kunde</th>
                  <th className="py-2 pr-3">Limit</th>
                  <th className="py-2 pr-3">Ausgenutzt</th>
                  <th className="py-2 pr-3">Ampel</th>
                  <th className="py-2 pr-3">Unlimitiert</th>
                  <th className="py-2 pr-3">Sperre</th>
                  <th className="py-2 pr-3">Grund</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const light = r.traffic_light ?? lightFor(Number(r.credit_limit ?? 0), Number(r.used_amount ?? 0), !!r.unlimited);
                  return (
                    <tr key={r.id} className="border-b border-border/50">
                      <td className="py-2 pr-3 font-medium">{r.customer_name ?? '—'}</td>
                      <td className="py-2 pr-3">
                        <Input
                          className="h-8 w-32"
                          defaultValue={r.unlimited ? '' : String(r.credit_limit ?? 0)}
                          disabled={!!r.unlimited}
                          onBlur={(e) => {
                            const v = Number((e.target.value || '0').replace(',', '.'));
                            if (v === Number(r.credit_limit ?? 0)) return;
                            patch(r.id, { credit_limit: v, traffic_light: lightFor(v, Number(r.used_amount ?? 0), !!r.unlimited) });
                          }}
                        />
                      </td>
                      <td className="py-2 pr-3">{fmt(r.used_amount)}</td>
                      <td className="py-2 pr-3">
                        <Badge variant="outline" className={LIGHT_CLASS[light] ?? ''}>{light}</Badge>
                      </td>
                      <td className="py-2 pr-3">
                        <Switch
                          checked={!!r.unlimited}
                          onCheckedChange={(v) => patch(r.id, { unlimited: v, traffic_light: lightFor(Number(r.credit_limit ?? 0), Number(r.used_amount ?? 0), v) })}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <Button
                          size="sm"
                          variant={r.blocked ? 'destructive' : 'outline'}
                          onClick={() => patch(r.id, { blocked: !r.blocked, block_reason: r.blocked ? null : (r.block_reason ?? 'Limit überschritten') })}
                        >
                          {r.blocked ? <><Ban className="mr-2 h-4 w-4" />Gesperrt</> : <><CheckCircle2 className="mr-2 h-4 w-4" />Frei</>}
                        </Button>
                      </td>
                      <td className="py-2 pr-3">
                        <Input
                          className="h-8 w-56"
                          defaultValue={r.block_reason ?? ''}
                          placeholder="Sperrgrund"
                          onBlur={(e) => {
                            const v = e.target.value.trim() || null;
                            if (v === (r.block_reason ?? null)) return;
                            patch(r.id, { block_reason: v });
                          }}
                        />
                      </td>
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
