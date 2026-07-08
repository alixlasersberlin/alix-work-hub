import { Card } from '@/components/ui/card';
import { EmpPersona } from '@/lib/emp/roles';
import { Calendar, Users, CheckSquare, Bell, TrendingUp, Package, GraduationCap, Truck, Wrench, ClipboardList } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Widget { title: string; value: string; icon: any; to: string; }

function widgetsFor(persona: EmpPersona): Widget[] {
  const base: Widget[] = [
    { title: 'Heute', value: '—', icon: Calendar, to: '/emp/kalender' },
    { title: 'Aufgaben', value: '—', icon: CheckSquare, to: '/emp/aufgaben' },
    { title: 'Kunden', value: '—', icon: Users, to: '/emp/kunden' },
    { title: 'Meldungen', value: '—', icon: Bell, to: '/emp/mehr' },
  ];
  switch (persona) {
    case 'technik': return [
      ...base,
      { title: 'Service-Einsätze', value: 'heute', icon: Wrench, to: '/emp/kalender' },
      { title: 'Checklisten', value: 'offen', icon: ClipboardList, to: '/emp/aufgaben' },
    ];
    case 'vertrieb': return [
      ...base,
      { title: 'Angebote', value: 'offen', icon: TrendingUp, to: '/emp/mehr' },
      { title: 'Vorführgeräte', value: '—', icon: Package, to: '/emp/mehr' },
    ];
    case 'dozent': return [
      ...base,
      { title: 'Schulungen', value: 'heute', icon: GraduationCap, to: '/emp/kalender' },
    ];
    case 'logistik': return [
      ...base,
      { title: 'Lieferungen', value: 'heute', icon: Truck, to: '/emp/kalender' },
      { title: 'Touren', value: 'aktiv', icon: Package, to: '/emp/kalender' },
    ];
    case 'management': return [
      ...base,
      { title: 'Auslastung', value: '—', icon: TrendingUp, to: '/emp/dashboard' },
      { title: 'Freigaben', value: 'offen', icon: CheckSquare, to: '/emp/genehmigungen' },
    ];
    default: return base;
  }
}

export default function HomeWidgets({ persona }: { persona: EmpPersona }) {
  const widgets = widgetsFor(persona);
  return (
    <div className="grid grid-cols-2 gap-3">
      {widgets.map((w) => (
        <Link to={w.to} key={w.title}>
          <Card className="p-3 hover:border-primary/50 transition-colors">
            <div className="flex items-start justify-between">
              <w.icon className="h-5 w-5 text-primary" />
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{w.value}</span>
            </div>
            <div className="mt-2 text-sm font-medium">{w.title}</div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
