import { PageHeader } from '@/components/infinity/PageHeader';
import { CommissionList } from '@/components/commission/CommissionList';
import { Ban } from 'lucide-react';

export default function ProvisionStornierte() {
  return (
    <div className="p-6 lg:p-8 animate-fade-in space-y-4">
      <PageHeader title="Stornierte Provisionen" subtitle="Stornierungen, Rückforderungen und gesperrte Provisionen" icon={Ban} />
      <CommissionList bucket="cancelled" />
    </div>
  );
}
