import { MonitorCheck } from 'lucide-react';
import { PlmCrudPage } from '@/components/plm/PlmCrudPage';
import { swTestFields } from '@/lib/plm/software';

export default function SwSystemTests() {
  return (
    <PlmCrudPage
      table="plm_sw_tests"
      title="System Tests (TP_SW575)"
      subtitle="Systemtests nach Testgruppen (Startup, Emergency Stop, Cooling, …). Ergebnisse nur nach tatsächlicher Durchführung."
      icon={MonitorCheck}
      fields={swTestFields('system')}
      orderBy="test_code"
      ascending
      extraFilter={(q) => q.eq('kind', 'system')}
      defaults={{ kind: 'system', result: 'offen' }}
    />
  );
}
