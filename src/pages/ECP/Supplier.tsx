import { Card } from '@/components/ui/card';
import { Package, Truck, FileText, AlertTriangle } from 'lucide-react';

const ITEMS = [
  { icon: Package, label: 'Bestellungen', desc: 'Eingang und Status' },
  { icon: FileText, label: 'Anfragen', desc: 'Angebotsanfragen (RFQ)' },
  { icon: Truck, label: 'Liefertermine', desc: 'Zusagen und Tracking' },
  { icon: FileText, label: 'Dokumente', desc: 'Lieferscheine, Zertifikate' },
  { icon: AlertTriangle, label: 'Qualitätsmeldungen', desc: 'Reklamationen und CAPA' },
];

export default function EcpSupplier() {
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
