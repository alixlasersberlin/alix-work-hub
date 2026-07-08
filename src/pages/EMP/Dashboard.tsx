import { Card } from '@/components/ui/card';
import { TrendingUp, Calendar, Users, Bell } from 'lucide-react';

const KPIS = [
  { label: 'Umsatz Monat', value: '—', icon: TrendingUp },
  { label: 'Auslastung', value: '—', icon: TrendingUp },
  { label: 'Termine heute', value: '—', icon: Calendar },
  { label: 'Neue Kunden', value: '—', icon: Users },
  { label: 'Offene Freigaben', value: '—', icon: Bell },
];

export default function EmpDashboard() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {KPIS.map((k) => (
          <Card key={k.label} className="p-3">
            <k.icon className="h-5 w-5 text-primary" />
            <div className="mt-2 text-xs text-muted-foreground">{k.label}</div>
            <div className="text-lg font-semibold">{k.value}</div>
          </Card>
        ))}
      </div>
      <Card className="p-4 text-sm text-muted-foreground">Live-Termine, Auslastung und Genehmigungen greifen später auf reale Datenquellen zu.</Card>
    </div>
  );
}
