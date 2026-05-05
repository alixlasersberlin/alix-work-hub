import { PackageCheck } from 'lucide-react';
import { PageHeader } from '@/components/PageShell';

export default function Leihgeraete() {
  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        icon={<PackageCheck className="w-6 h-6 text-primary" />}
        title="Leihgeräte"
        subtitle="Übersicht aller Leihgeräte"
      />
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        Leihgeräte – Inhalt folgt.
      </div>
    </div>
  );
}
