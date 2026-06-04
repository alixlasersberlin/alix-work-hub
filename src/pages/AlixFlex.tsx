import { Zap } from 'lucide-react';
import { PageHeader } from '@/components/PageShell';

export default function AlixFlex() {
  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        icon={<Zap className="w-6 h-6 text-primary" />}
        title="ALIX FLEX"
        subtitle="Dieser Bereich befindet sich im Aufbau."
      />
    </div>
  );
}
