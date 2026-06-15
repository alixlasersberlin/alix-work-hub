import { ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/infinity/PageHeader';

export default function Iso13485() {
  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <PageHeader
        icon={ShieldCheck}
        title="ISO 13485"
        subtitle="Qualitätsmanagementsystem für Medizinprodukte."
        noBreadcrumbs
      />
      <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        Dieses Modul wird in Kürze verfügbar sein.
      </div>
    </div>
  );
}
