import { Lock } from 'lucide-react';
import { PageHeader } from '@/components/infinity/PageHeader';

export default function Geraetesperren() {
  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        icon={Lock}
        title="Gerätesperren"
        subtitle="Übersicht und Verwaltung gesperrter Geräte"
        noBreadcrumbs
      />
      <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-8 text-center text-muted-foreground">
        Gerätesperren – Inhalt folgt.
      </div>
    </div>
  );
}
