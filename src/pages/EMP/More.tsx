import { Card } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Settings, Bell, ClipboardList, ShieldCheck, Truck, TrendingUp, GraduationCap, LayoutDashboard, RefreshCw } from 'lucide-react';
import { useEmpPersona } from '@/hooks/emp/useEmpPersona';

const items = [
  { to: '/emp/dashboard', label: 'Dashboard', icon: LayoutDashboard, personas: ['management'] as string[] },
  { to: '/emp/genehmigungen', label: 'Genehmigungen', icon: ShieldCheck, personas: ['management'] as string[] },
  { to: '/emp/servicebericht', label: 'Servicebericht', icon: ClipboardList, personas: ['technik'] as string[] },
  { to: '/emp/schulungen', label: 'Schulungen', icon: GraduationCap, personas: ['dozent'] as string[] },
  { to: '/emp/lieferungen', label: 'Lieferungen', icon: Truck, personas: ['logistik'] as string[] },
  { to: '/emp/vertrieb', label: 'Vertrieb', icon: TrendingUp, personas: ['vertrieb'] as string[] },
  { to: '/emp/benachrichtigungen', label: 'Benachrichtigungen', icon: Bell, personas: [] as string[] },
  { to: '/emp/sync', label: 'Synchronisation', icon: RefreshCw, personas: [] as string[] },
  { to: '/emp/einstellungen', label: 'Einstellungen', icon: Settings, personas: [] as string[] },
];

export default function EmpMore() {
  const { persona } = useEmpPersona();
  const visible = items.filter(i => i.personas.length === 0 || i.personas.includes(persona) || persona === 'management');
  return (
    <div className="grid grid-cols-2 gap-3">
      {visible.map((i) => (
        <Link to={i.to} key={i.to}>
          <Card className="p-4 hover:border-primary/50 flex flex-col items-start gap-2">
            <i.icon className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">{i.label}</span>
          </Card>
        </Link>
      ))}
    </div>
  );
}
