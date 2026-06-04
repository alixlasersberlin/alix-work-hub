import { Lock } from 'lucide-react';
import { PageHeader } from '@/components/PageShell';

export default function Geraetesperren() {
  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        icon={<Lock className="w-6 h-6 text-red-500" />}
        title="Gerätesperren"
        subtitle="Übersicht und Verwaltung gesperrter Geräte"
      />
      <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-8 text-center text-muted-foreground">
        Gerätesperren – Inhalt folgt.
      </div>
    </div>
  );
}
