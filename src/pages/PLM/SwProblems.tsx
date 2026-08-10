import { LifeBuoy } from 'lucide-react';
import { PlmCrudPage } from '@/components/plm/PlmCrudPage';
import { swProblemFields } from '@/lib/plm/software';

export default function SwProblems() {
  return (
    <PlmCrudPage
      table="plm_sw_problems"
      title="Problem Resolution (Post-Market → CAPA)"
      subtitle="Problemmeldungen aus Markt, Service und Anwenderbefragung mit Untersuchung, Korrektur, CAPA-Verknüpfung und Wirksamkeitsprüfung."
      icon={LifeBuoy}
      fields={swProblemFields}
      orderBy="reported_at"
      defaults={{ status: 'offen', source: 'post_market', severity: 'mittel' }}
    />
  );
}
