import { ListChecks } from 'lucide-react';
import { PlmCrudPage } from '@/components/plm/PlmCrudPage';
import { swRequirementFields } from '@/lib/plm/software';

export default function SwRequirements() {
  return (
    <PlmCrudPage
      table="plm_sw_requirements"
      title="Software Requirements"
      subtitle="Anforderungsmanagement nach IEC 62304 — SW-REQ-IDs mit Quelle, Unit, Verifikationsmethode und Akzeptanzkriterien."
      icon={ListChecks}
      fields={swRequirementFields}
      orderBy="req_code"
      ascending
      defaults={{ status: 'entwurf', priority: 'mittel' }}
    />
  );
}
