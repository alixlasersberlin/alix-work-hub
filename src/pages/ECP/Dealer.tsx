import { Card } from '@/components/ui/card';
import { Package, TrendingUp, GraduationCap, Percent, FileText, Download } from 'lucide-react';

const ITEMS = [
  { icon: Package, label: 'Bestellungen', desc: 'Übersicht Ihrer Zoho-Bestellungen' },
  { icon: Percent, label: 'Provisionen', desc: 'Abrechnungen und Provisionsläufe' },
  { icon: GraduationCap, label: 'Schulungen', desc: 'Händler-Schulungen und Zertifikate' },
  { icon: Package, label: 'Demo-Geräte', desc: 'Vorführgeräte anfragen und verwalten' },
  { icon: FileText, label: 'Preislisten', desc: 'Aktuelle Konditionen und Rabattstufen' },
  { icon: TrendingUp, label: 'Verkaufsstatistik', desc: 'Monat, Quartal, Jahr' },
  { icon: Download, label: 'Marketing-Downloads', desc: 'Bilder, Broschüren, Videos' },
];

export default function EcpDealer() {
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
