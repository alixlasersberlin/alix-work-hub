import { Wrench } from 'lucide-react';
import { PageHeader } from '@/components/infinity/PageHeader';

export default function Reparaturannahme() {
  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <PageHeader
        icon={Wrench}
        title="Reparaturannahme"
        subtitle="Dieses Modul wird in Kürze verfügbar sein."
        noBreadcrumbs
      />
      <div className="rounded-xl border border-border bg-card p-8 card-glow text-center text-muted-foreground mt-6">
        Dieses Modul wird in Kürze verfügbar sein.
      </div>
    </div>
  );
}
