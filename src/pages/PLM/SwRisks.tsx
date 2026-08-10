import { ShieldAlert } from 'lucide-react';
import { PlmCrudPage } from '@/components/plm/PlmCrudPage';
import { swRiskFields } from '@/lib/plm/software';

export default function SwRisks() {
  return (
    <PlmCrudPage
      table="plm_sw_risks"
      title="Software Risk Management"
      subtitle="Software-Risiken nach IEC 62304, verknüpft mit dem ISO-14971-Risikomanagement."
      icon={ShieldAlert}
      fields={swRiskFields}
      orderBy="risk_code"
      ascending
      defaults={{ severity: 1, probability: 1, status: 'offen' }}
    />
  );
}
