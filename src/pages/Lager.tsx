import { Warehouse } from 'lucide-react';
import { PageHeader } from '@/components/PageShell';

export default function Lager() {
  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        icon={<Warehouse className="w-6 h-6 text-primary" />}
        title="Lager"
        subtitle="Lagerverwaltung"
      />
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        Lagerverwaltung – Inhalt folgt.
      </div>
    </div>
  );
}
