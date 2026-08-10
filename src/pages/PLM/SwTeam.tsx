import { Users } from 'lucide-react';
import { PlmCrudPage } from '@/components/plm/PlmCrudPage';
import { swTeamFields } from '@/lib/plm/software';

export default function SwTeam() {
  return (
    <PlmCrudPage
      table="plm_sw_team"
      title="Development Team & Environment"
      subtitle="Software- und Hardware-Entwicklungsteam, IDE, Versionsverwaltung und Versionierungsschema."
      icon={Users}
      fields={swTeamFields}
      orderBy="name"
      ascending
      defaults={{ team: 'software' }}
    />
  );
}
