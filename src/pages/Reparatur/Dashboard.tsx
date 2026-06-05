import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { sbRepair } from '@/lib/repair/api';
import { Card } from '@/components/ui/card';
import { Wrench, Inbox, HardHat, Package, Receipt, MapPin, CheckCircle2, Clock } from 'lucide-react';

type Counts = Record<string, number>;

export default function ReparaturDashboard() {
  const [counts, setCounts] = useState<Counts>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await sbRepair.from('repair_orders').select('status');
      const c: Counts = {};
      (data || []).forEach((r: any) => {
        c[r.status] = (c[r.status] || 0) + 1;
      });
      c.__total = (data || []).length;
      setCounts(c);
      setLoading(false);
    })();
  }, []);

  const kpis = [
    { label: 'Offene Reparaturen', value: (counts.__total || 0) - (counts['Abgeschlossen'] || 0) - (counts['Storniert'] || 0), icon: Wrench, color: 'text-primary' },
    { label: 'Neue Reparaturen', value: counts['Reparatur angelegt'] || 0, icon: Inbox, color: 'text-blue-400' },
    { label: 'Geräte unterwegs', value: counts['Gerät / Teil wird eingeholt'] || 0, icon: Clock, color: 'text-cyan-400' },
    { label: 'Geräte eingetroffen', value: counts['Gerät / Teil eingetroffen'] || 0, icon: Inbox, color: 'text-teal-400' },
    { label: 'In Technik', value: (counts['In Prüfung'] || 0) + (counts['Reparatur in Arbeit'] || 0) + (counts['Arbeitsauftrag Technik erstellt'] || 0), icon: HardHat, color: 'text-indigo-400' },
    { label: 'Ersatzteile offen', value: (counts['Ersatzteile benötigt'] || 0) + (counts['Ersatzteile bestellt'] || 0), icon: Package, color: 'text-orange-400' },
    { label: 'Abgeschlossen', value: counts['Reparatur abgeschlossen'] || 0, icon: CheckCircle2, color: 'text-emerald-400' },
    { label: 'Übergabe Finance', value: counts['Übergabe an Finance'] || 0, icon: Receipt, color: 'text-yellow-400' },
    { label: 'Übergabe Tourenplanung', value: counts['Übergabe an Tourenplanung'] || 0, icon: MapPin, color: 'text-sky-400' },
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
