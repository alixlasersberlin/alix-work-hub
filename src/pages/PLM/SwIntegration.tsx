import { GitMerge } from 'lucide-react';
import { PlmCrudPage } from '@/components/plm/PlmCrudPage';
import { swTestFields } from '@/lib/plm/software';

export default function SwIntegration() {
  return (
    <PlmCrudPage
      table="plm_sw_tests"
      title="Integration Tests (TP_SW563)"
      subtitle="Integrationstests zwischen Software-Einheiten. Ergebnisse nur nach tatsächlicher Durchführung."
      icon={GitMerge}
      fields={swTestFields('integration')}
      orderBy="test_code"
      ascending
      extraFilter={(q) => q.eq('kind', 'integration')}
      defaults={{ kind: 'integration', result: 'offen' }}
    />
  );
}
