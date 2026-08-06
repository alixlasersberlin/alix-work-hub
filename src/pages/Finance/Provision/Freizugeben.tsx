import { PageHeader } from '@/components/infinity/PageHeader';
import { CommissionList } from '@/components/commission/CommissionList';
import { ShieldCheck } from 'lucide-react';

export default function ProvisionFreizugeben() {
  return (
    <div className="p-6 lg:p-8 animate-fade-in space-y-4">
      <PageHeader title="Freizugebende Provisionen" subtitle="Wirksame Provisionen warten auf Freigabe durch Admin oder Super Admin" icon={ShieldCheck} />
      <CommissionList bucket="approval" />
    </div>
  );
}
