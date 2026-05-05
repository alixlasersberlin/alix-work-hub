import { PageHeader } from '@/components/PageShell';
import { FileText } from 'lucide-react';

export default function OffenePosten() {
  return (
    <div className="p-4 sm:p-6 space-y-4">
      <PageHeader icon={<FileText className="w-5 h-5" />} title="Offene Posten" subtitle="Übersicht offener Posten" />
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        Diese Ansicht wird in Kürze mit Daten gefüllt.
      </div>
    </div>
  );
}
