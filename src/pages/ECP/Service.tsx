import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wrench, Calendar, HardHat, ShieldCheck, RadioTower } from 'lucide-react';
import { toast } from 'sonner';

const ACTIONS = [
  { key: 'anfrage', label: 'Service anfragen', icon: Wrench },
  { key: 'wartung', label: 'Wartung buchen', icon: Calendar },
  { key: 'reparatur', label: 'Reparatur melden', icon: HardHat },
  { key: 'vorort', label: 'Vor-Ort-Service', icon: Wrench },
  { key: 'fern', label: 'Fernwartung', icon: RadioTower },
  { key: 'garantie', label: 'Garantie prüfen', icon: ShieldCheck },
];

export default function EcpService() {
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {ACTIONS.map((a) => (
        <Card key={a.key} className="p-4 space-y-3">
          <a.icon className="h-6 w-6 text-primary" />
          <div className="text-sm font-medium">{a.label}</div>
          <Button size="sm" onClick={() => toast.success(`${a.label}: Anfrage gesendet`)}>Anfrage senden</Button>
        </Card>
      ))}
    </div>
  );
}
