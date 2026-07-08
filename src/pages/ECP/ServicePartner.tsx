import { Card } from '@/components/ui/card';
import { Wrench, FileText, Camera, FileSignature, History, Package } from 'lucide-react';

const ITEMS = [
  { icon: Wrench, label: 'Zugewiesene Einsätze', desc: 'Auftragsübersicht' },
  { icon: FileText, label: 'Serviceberichte', desc: 'Erfassen und einreichen' },
  { icon: Camera, label: 'Fotos', desc: 'Vor/Nach der Reparatur' },
  { icon: FileSignature, label: 'Signaturen', desc: 'Kunden- und Technikerunterschrift' },
  { icon: Package, label: 'Ersatzteile', desc: 'Verbrauch dokumentieren' },
  { icon: History, label: 'Historie', desc: 'Alle abgeschlossenen Einsätze' },
];

export default function EcpServicePartner() {
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {ITEMS.map((i) => (
        <Card key={i.label} className="p-4">
          <i.icon className="h-5 w-5 text-primary" />
          <div className="mt-2 text-sm font-medium">{i.label}</div>
          <div className="text-xs text-muted-foreground">{i.desc}</div>
        </Card>
      ))}
    </div>
  );
}
