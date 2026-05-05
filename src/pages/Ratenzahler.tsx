import { PageHeader } from '@/components/PageShell';
import { Banknote } from 'lucide-react';

export default function Ratenzahler() {
  return (
    <div className="p-6">
      <PageHeader
        icon={<Banknote className="w-6 h-6 text-primary" />}
        title="Ratenzahler"
        subtitle="Übersicht der Ratenzahler"
      />
      <div className="text-sm text-muted-foreground">Noch keine Daten verfügbar.</div>
    </div>
  );
}
