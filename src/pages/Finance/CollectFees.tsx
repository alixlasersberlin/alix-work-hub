import { useEffect, useState } from 'react';
import { Percent, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/infinity/PageHeader';
import { SkeletonTable } from '@/components/infinity/Skeleton';
import { EmptyState } from '@/components/infinity/EmptyState';

export default function FinanceCollectFees() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [country, setCountry] = useState('');

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('collect_fee_rules' as any).select('*').order('country_code', { ascending: true });
    if (error) toast({ title: 'Laden fehlgeschlagen', description: error.message, variant: 'destructive' });
    setRows((data as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const patch = async (id: string, values: Record<string, any>) => {
    const { error } = await supabase.from('collect_fee_rules' as any).update({ ...values, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    load();
  };

  const create = async () => {
    const code = country.trim().toUpperCase();
    if (code.length !== 2) { toast({ title: 'Länderkürzel mit 2 Zeichen angeben', variant: 'destructive' }); return; }
    const { error } = await supabase.from('collect_fee_rules' as any).insert({ country_code: code });
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    setCountry('');
    load();
  };

  const numField = (r: any, key: string, width = 'w-24', suffix = '') => (
    <div className="flex items-center gap-1">
      <Input className={`h-8 ${width}`} defaultValue={String(r[key] ?? 0)}
        onBlur={(e) => { const v = Number(e.target.value || 0); if (v !== Number(r[key] ?? 0)) patch(r.id, { [key]: v }); }} />
      {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Mahngebühren & Verzugszinsen" subtitle="Länderspezifische Gebühren je Mahnstufe und automatische Zinsberechnung" icon={Percent} />

      <DataCard title="Land ergänzen">
        <div className="flex items-center gap-2">
          <Input className="w-32" placeholder="DE / AT / CH" value={country} onChange={(e) => setCountry(e.target.value)} />
          <Button onClick={create}><Plus className="mr-2 h-4 w-4" />Hinzufügen</Button>
        </div>
      </DataCard>

      <DataCard title="Regeln">
        {loading ? (
          <SkeletonTable rows={4} />
        ) : rows.length === 0 ? (
          <EmptyState icon={Percent} title="Keine Regeln" description="Lege pro Land Gebühren und Zinssätze fest." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-3">Land</th>
                  <th className="py-2 pr-3">Mahnung 1</th>
                  <th className="py-2 pr-3">Mahnung 2</th>
                  <th className="py-2 pr-3">Mahnung 3</th>
                  <th className="py-2 pr-3">Verzugszins p. a.</th>
                  <th className="py-2 pr-3">Basiszins</th>
                  <th className="py-2 pr-3">Pauschale B2B</th>
                  <th className="py-2 pr-3">Zinsen aktiv</th>
                  <th className="py-2 pr-3">Aktiv</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/50">
                    <td className="py-2 pr-3 font-medium">{r.country_code}</td>
                    <td className="py-2 pr-3">{numField(r, 'fee_stage_1', 'w-20', '€')}</td>
                    <td className="py-2 pr-3">{numField(r, 'fee_stage_2', 'w-20', '€')}</td>
                    <td className="py-2 pr-3">{numField(r, 'fee_stage_3', 'w-20', '€')}</td>
                    <td className="py-2 pr-3">{numField(r, 'interest_rate_pct', 'w-20', '%')}</td>
                    <td className="py-2 pr-3">{numField(r, 'base_rate_pct', 'w-20', '%')}</td>
                    <td className="py-2 pr-3">{numField(r, 'flat_fee_b2b', 'w-20', '€')}</td>
                    <td className="py-2 pr-3"><Switch checked={!!r.charge_interest} onCheckedChange={(v) => patch(r.id, { charge_interest: v })} /></td>
                    <td className="py-2 pr-3"><Switch checked={!!r.active} onCheckedChange={(v) => patch(r.id, { active: v })} /></td>
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
