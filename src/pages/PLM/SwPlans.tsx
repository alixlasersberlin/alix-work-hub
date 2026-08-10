import { FileText } from 'lucide-react';
import { PlmCrudPage } from '@/components/plm/PlmCrudPage';
import { swPlanFields } from '@/lib/plm/software';

export default function SwPlans() {
  return (
    <PlmCrudPage
      table="plm_sw_plans"
      title="Pläne (SDP · SCMP · Wartung · Problem Resolution)"
      subtitle="Software-Entwicklungsplan, Konfigurationsmanagement-Plan, Wartungs- und Problem-Resolution-Plan nach IEC 62304."
      icon={FileText}
      fields={swPlanFields}
      orderBy="created_at"
      defaults={{ status: 'entwurf', plan_kind: 'development_plan' }}
    />
  );
}
