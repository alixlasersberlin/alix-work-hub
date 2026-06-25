import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { sbRepair } from '@/lib/repair/api';
import { Card } from '@/components/ui/card';
import { Wrench, Inbox, HardHat, Package, Receipt, MapPin, CheckCircle2, Truck, Plus, ListChecks } from 'lucide-react';
import { PageHeader } from '@/components/infinity/PageHeader';
import { KpiTile } from '@/components/infinity/KpiTile';
import { SkeletonKpiGrid } from '@/components/infinity/Skeleton';
import { StatusBadge as InfinityStatusBadge } from '@/components/infinity/StatusBadge';
import { Button } from '@/components/ui/button';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';

type Counts = Record<string, number>;

export default function ReparaturDashboard() {
  const [counts, setCounts] = useState<Counts>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await sbRepair.from('repair_orders').select('repair_status');
    const c: Counts = {};
    (data || []).forEach((r: any) => {
      c[r.repair_status] = (c[r.repair_status] || 0) + 1;
    });
    c.__total = (data || []).length;
    setCounts(c);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useRealtimeRefresh(['repair_orders'], load);

  const open = (counts.__total || 0) - (counts['Ausgeliefert'] || 0) - (counts['Storniert'] || 0);
  const kpis = [
    { label: 'Offene Reparaturen', value: open, icon: Wrench, accent: 'gold' as const },
    { label: 'Neu', value: counts['Neu'] || 0, icon: Inbox, accent: 'sky' as const },
    { label: 'In Werkstatt', value: counts['In Werkstatt'] || 0, icon: Inbox, accent: 'gold' as const },
    { label: 'In Diagnose / Reparatur', value: (counts['In Diagnose'] || 0) + (counts['In Reparatur'] || 0), icon: HardHat, accent: 'violet' as const },
    { label: 'Warte auf Ersatzteile', value: counts['Warte auf Ersatzteile'] || 0, icon: Package, accent: 'rose' as const },
    { label: 'Abgeschlossen', value: counts['Reparatur abgeschlossen'] || 0, icon: CheckCircle2, accent: 'emerald' as const },
    { label: 'An Finance', value: counts['An Finance übergeben'] || 0, icon: Receipt, accent: 'gold' as const },
    { label: 'An Tourenplanung', value: counts['An Tourenplanung übergeben'] || 0, icon: MapPin, accent: 'sky' as const },
    { label: 'Ausgeliefert', value: counts['Ausgeliefert'] || 0, icon: Truck, accent: 'emerald' as const },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reparatur"
        subtitle="Übersicht aller Reparaturaufträge und Status"
        icon={Wrench}
        noBreadcrumbs
        meta={<InfinityStatusBadge kind="done" label="Live" pulse dotOnly />}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/reparatur/auftraege"><ListChecks className="w-4 h-4 mr-2" />Alle Aufträge</Link>
            </Button>
            <Button asChild size="sm" className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold border-0">
              <Link to="/reparatur/neu"><Plus className="w-4 h-4 mr-2" />Neue Reparatur</Link>
            </Button>
          </>
        }
      />

      {loading ? (
        <SkeletonKpiGrid count={9} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {kpis.map((k) => (
            <KpiTile key={k.label} label={k.label} value={k.value} icon={k.icon} accent={k.accent} />
          ))}
        </div>
      )}

      <Card className="p-4">
        <p className="text-sm text-muted-foreground">
          Schnellzugriff:{' '}
          <Link className="text-amber-300 hover:underline" to="/reparatur/neu">Neue Reparatur anlegen</Link>{' · '}
          <Link className="text-amber-300 hover:underline" to="/reparatur/auftraege">Alle Aufträge</Link>
        </p>
      </Card>
    </div>
  );
}
