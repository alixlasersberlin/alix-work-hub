import { Boxes } from 'lucide-react';
import { PlmCrudPage } from '@/components/plm/PlmCrudPage';
import { swUnitFields } from '@/lib/plm/software';

export default function SwUnits() {
  return (
    <PlmCrudPage
      table="plm_sw_units"
      title="Software Architecture — Units"
      subtitle="Software-Einheiten nach IEC 62304 mit Safety Classification, Owner und Verifikationsstatus."
      icon={Boxes}
      fields={swUnitFields}
      orderBy="unit_code"
      ascending
      defaults={{ safety_class: 'B', verification_status: 'offen' }}
    />
  );
}
