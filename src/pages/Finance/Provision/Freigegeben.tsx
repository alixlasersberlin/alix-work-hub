import { PageHeader } from '@/components/infinity/PageHeader';
import { CommissionList } from '@/components/commission/CommissionList';
import { CheckCircle2 } from 'lucide-react';

export default function ProvisionFreigegeben() {
  return (
    <div className="p-6 lg:p-8 animate-fade-in space-y-4">
      <PageHeader title="Freigegebene Provisionen" subtitle="Freigegebene und zur Auszahlung vorgemerkte Provisionen" icon={CheckCircle2} />
      <CommissionList bucket="approved" />
    </div>
  );
}
