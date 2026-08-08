import { useEffect, useMemo, useState } from 'react';
import { Cpu, Lock, Plus, ShieldOff, Unlock } from 'lucide-react';
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

const dateFmt = (v: any) => (v ? new Date(v).toLocaleDateString('de-DE') : '—');

export default function FinanceCollectDevices() {
  const [rows, setRows] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [name, setName] = useState('');
  const [model, setModel] = useState('');
  const [serial, setSerial] = useState('');
  const [invoiceRef, setInvoiceRef] = useState('');

  const load = async () => {
    setLoading(true);
    const [d, c] = await Promise.all([
      supabase.from('collect_device_links' as any).select('*').order('updated_at', { ascending: false }).limit(500),
      supabase.from('collect_cases' as any).select('customer_name,overdue_amount,max_days_overdue').limit(1000),
    ]);
    if (d.error) toast({ title: 'Laden fehlgeschlagen', description: d.error.message, variant: 'destructive' });
    setRows((d.data as any) ?? []);
    setCases((c.data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const overdueByCustomer = useMemo(() => {
    const m = new Map<string, { amount: number; days: number }>();
    for (const c of cases) {
      const key = (c.customer_name as string) || '';
      if (!key) continue;
      const prev = m.get(key) ?? { amount: 0, days: 0 };
      m.set(key, {
        amount: prev.amount + Number(c.overdue_amount ?? 0),
        days: Math.max(prev.days, Number(c.max_days_overdue ?? 0)),
      });
    }
    return m;
  }, [cases]);

  const create = async () => {
    if (!name.trim() || !serial.trim()) {
      toast({ title: 'Kunde und Seriennummer erforderlich', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('collect_device_links' as any).insert({
      customer_name: name.trim(),
      device_model: model.trim() || null,
      serial_number: serial.trim(),
      invoice_reference: invoiceRef.trim() || null,
      spare_parts_block: false,
      comfort_features_block: false,
    });
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    setName(''); setModel(''); setSerial(''); setInvoiceRef('');
    toast({ title: 'Gerät verknüpft' });
    load();
  };

  const patch = async (id: string, values: Record<string, any>) => {
    const { error } = await supabase.from('collect_device_links' as any)
      .update({ ...values, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    load();
  };

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase();
    return !q
      || (r.customer_name ?? '').toLowerCase().includes(q)
      || (r.serial_number ?? '').toLowerCase().includes(q)
      || (r.device_model ?? '').toLowerCase().includes(q);
  });

  const blockedCount = rows.filter((r) => r.spare_parts_block || r.comfort_features_block).length;
  const atRisk = rows.filter((r) => (overdueByCustomer.get(r.customer_name)?.days ?? 0) >= 30).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Geräte & Remote-Sperren"
        subtitle="Geräte je Kunde verknüpfen, Ersatzteil- und Komfortfunktionen bei Zahlungsverzug sperren"
        icon={Cpu}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <DataCard title="Verknüpfte Geräte"><div className="text-2xl font-semibold">{rows.length}</div></DataCard>
        <DataCard title="Aktive Sperren"><div className="text-2xl font-semibold text-destructive">{blockedCount}</div></DataCard>
        <DataCard title="Sperr-Kandidaten (&gt;30 Tage überfällig)"><div className="text-2xl font-semibold text-amber-500">{atRisk}</div></DataCard>
      </div>

      <DataCard title="Gerät verknüpfen">
        <div className="flex flex-wrap items-center gap-2">
          <Input className="w-56" placeholder="Kundenname" value={name} onChange={(e) => setName(e.target.value)} />
          <Input className="w-44" placeholder="Modell" value={model} onChange={(e) => setModel(e.target.value)} />
          <Input className="w-44" placeholder="Seriennummer" value={serial} onChange={(e) => setSerial(e.target.value)} />
          <Input className="w-44" placeholder="Rechnungsbezug" value={invoiceRef} onChange={(e) => setInvoiceRef(e.target.value)} />
          <Button onClick={create}><Plus className="mr-2 h-4 w-4" />Verknüpfen</Button>
        </div>
      </DataCard>

      <DataCard title="Geräte">
        <div className="mb-3">
          <Input className="w-72" placeholder="Kunde, Modell oder Seriennummer…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {loading ? (
          <SkeletonTable rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Cpu} title="Keine Geräte verknüpft" description="Verknüpfe oben ein Gerät mit einem Kunden." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-3">Kunde</th>
                  <th className="py-2 pr-3">Modell / Seriennr.</th>
                  <th className="py-2 pr-3">Rechnung</th>
                  <th className="py-2 pr-3">Garantie</th>
                  <th className="py-2 pr-3">Verzug</th>
                  <th className="py-2 pr-3">Ersatzteile</th>
                  <th className="py-2 pr-3">Komfort</th>
                  <th className="py-2 pr-3">Notiz</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const od = overdueByCustomer.get(r.customer_name);
                  const days = od?.days ?? 0;
                  return (
                    <tr key={r.id} className="border-b border-border/50">
                      <td className="py-2 pr-3 font-medium">{r.customer_name ?? '—'}</td>
                      <td className="py-2 pr-3">
                        <div>{r.device_model ?? '—'}</div>
                        <div className="text-xs text-muted-foreground">{r.serial_number ?? '—'}</div>
                      </td>
                      <td className="py-2 pr-3">{r.invoice_reference ?? '—'}</td>
                      <td className="py-2 pr-3">{dateFmt(r.warranty_until)}</td>
                      <td className="py-2 pr-3">
                        {days > 0 ? (
                          <Badge
                            variant="outline"
                            className={days >= 30
                              ? 'border-destructive/30 bg-destructive/15 text-destructive'
                              : 'border-amber-500/30 bg-amber-500/15 text-amber-500'}
                          >
                            {days} Tage
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/15 text-emerald-500">ok</Badge>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <Switch
                          checked={!!r.spare_parts_block}
                          onCheckedChange={(v) => patch(r.id, { spare_parts_block: v })}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <Switch
                          checked={!!r.comfort_features_block}
                          onCheckedChange={(v) => patch(r.id, { comfort_features_block: v })}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <Input
                          className="h-8 w-52"
                          defaultValue={r.block_note ?? ''}
                          placeholder="Sperrnotiz"
                          onBlur={(e) => {
                            const v = e.target.value.trim() || null;
                            if (v === (r.block_note ?? null)) return;
                            patch(r.id, { block_note: v });
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

      <DataCard title="Hinweis">
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <ShieldOff className="mt-0.5 h-4 w-4 shrink-0" />
          Sperren wirken auf Ersatzteil-Bestellungen und Komfortfunktionen. Sicherheitsrelevante Gerätefunktionen
          bleiben gemäß MDR jederzeit uneingeschränkt nutzbar.
        </p>
        <div className="mt-3 flex gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> gesperrt</span>
          <span className="flex items-center gap-1"><Unlock className="h-3 w-3" /> frei</span>
        </div>
      </DataCard>
    </div>
  );
}
