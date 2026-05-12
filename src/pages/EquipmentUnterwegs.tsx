import { Truck } from 'lucide-react';
import { PageHeader } from '@/components/PageShell';

export default function EquipmentUnterwegs() {
  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        icon={<Truck className="w-6 h-6 text-primary" />}
        title="Unterwegs"
        subtitle="Equipment, das aktuell unterwegs ist"
      />
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        Unterwegs – Inhalt folgt.
      </div>
    </div>
  );
}
