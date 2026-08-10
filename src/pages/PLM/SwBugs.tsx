import { Bug } from 'lucide-react';
import { PlmCrudPage } from '@/components/plm/PlmCrudPage';
import { swBugFields } from '@/lib/plm/software';

export default function SwBugs() {
  return (
    <PlmCrudPage
      table="plm_sw_bugs"
      title="Software Bugs & Issues"
      subtitle="Bug → Requirement → Risk → Change → Test → Release."
      icon={Bug}
      fields={swBugFields}
      orderBy="reported_at"
      defaults={{ severity: 'mittel', status: 'offen' }}
    />
  );
}
