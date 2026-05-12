import { Factory } from 'lucide-react';
import { PageHeader } from '@/components/PageShell';

export default function EquipmentProduktion() {
  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        icon={<Factory className="w-6 h-6 text-primary" />}
        title="Produktion"
        subtitle="Equipment in der Produktion"
      />
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        Produktion – Inhalt folgt.
      </div>
    </div>
  );
}
