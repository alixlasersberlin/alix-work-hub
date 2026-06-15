import { ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/infinity/PageHeader';

export default function MdrCe() {
  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <PageHeader
        icon={ShieldCheck}
        title="MDR CE"
        subtitle="Medical Device Regulation – CE-Konformität."
        noBreadcrumbs
      />
      <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        Dieser Bereich befindet sich im Aufbau.
      </div>
    </div>
  );
}
