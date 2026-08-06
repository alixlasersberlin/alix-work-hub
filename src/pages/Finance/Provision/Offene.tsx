import { PageHeader } from '@/components/infinity/PageHeader';
import { CommissionList } from '@/components/commission/CommissionList';
import { Clock } from 'lucide-react';

export default function ProvisionOffene() {
  return (
    <div className="p-6 lg:p-8 animate-fade-in space-y-4">
      <PageHeader title="Offene Provisionen" subtitle="Berechnete Provisionen, deren Voraussetzungen noch geprüft werden" icon={Clock} />
      <CommissionList bucket="open" />
    </div>
  );
}
