import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { sbRepair } from '@/lib/repair/api';
import { Card } from '@/components/ui/card';
import { Wrench, Inbox, HardHat, Package, Receipt, MapPin, CheckCircle2, Truck } from 'lucide-react';

type Counts = Record<string, number>;

export default function ReparaturDashboard() {
  const [counts, setCounts] = useState<Counts>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await sbRepair.from('repair_orders').select('repair_status');
      const c: Counts = {};
      (data || []).forEach((r: any) => {
        c[r.repair_status] = (c[r.repair_status] || 0) + 1;
      });
      c.__total = (data || []).length;
      setCounts(c);
      setLoading(false);
    })();
  }, []);

  const open = (counts.__total || 0) - (counts['Ausgeliefert'] || 0) - (counts['Storniert'] || 0);
  const kpis = [
    { label: 'Offene Reparaturen', value: open, icon: Wrench, color: 'text-primary' },
    { label: 'Neu', value: counts['Neu'] || 0, icon: Inbox, color: 'text-blue-400' },
    { label: 'In Werkstatt', value: counts['In Werkstatt'] || 0, icon: Inbox, color: 'text-amber-400' },
    { label: 'In Diagnose / Reparatur', value: (counts['In Diagnose'] || 0) + (counts['In Reparatur'] || 0), icon: HardHat, color: 'text-indigo-400' },
    { label: 'Warte auf Ersatzteile', value: counts['Warte auf Ersatzteile'] || 0, icon: Package, color: 'text-orange-400' },
    { label: 'Abgeschlossen', value: counts['Reparatur abgeschlossen'] || 0, icon: CheckCircle2, color: 'text-emerald-400' },
    { label: 'An Finance', value: counts['An Finance übergeben'] || 0, icon: Receipt, color: 'text-yellow-400' },
    { label: 'An Tourenplanung', value: counts['An Tourenplanung übergeben'] || 0, icon: MapPin, color: 'text-sky-400' },
    { label: 'Ausgeliefert', value: counts['Ausgeliefert'] || 0, icon: Truck, color: 'text-green-400' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="p-4 card-glow">
              <div className="flex items-center justify-between">
                <Icon className={`w-5 h-5 ${k.color}`} />
                <span className="text-2xl font-bold tabular-nums">{loading ? '–' : k.value}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{k.label}</p>
            </Card>
          );
        })}
      </div>

      <Card className="p-4">
        <p className="text-sm text-muted-foreground">
          Schnellzugriff:{' '}
          <Link className="text-primary hover:underline" to="/reparatur/neu">Neue Reparatur anlegen</Link>{' · '}
          <Link className="text-primary hover:underline" to="/reparatur/auftraege">Alle Aufträge</Link>
        </p>
      </Card>
    </div>
  );
}
