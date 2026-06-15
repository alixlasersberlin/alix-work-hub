import { Package } from 'lucide-react';
import { PageHeader } from '@/components/infinity/PageHeader';

export default function EquipmentArea() {
  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        icon={Package}
        title="Geräte Pool"
        subtitle="Verwaltung des Equipment-Bereichs"
        noBreadcrumbs
      />
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        Geräte Pool – Inhalt folgt.
      </div>
    </div>
  );
}
