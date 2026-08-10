import { CheckCircle2 } from 'lucide-react';
import { PlmCrudPage } from '@/components/plm/PlmCrudPage';
import { swTestFields } from '@/lib/plm/software';

export default function SwVerification() {
  return (
    <PlmCrudPage
      table="plm_sw_tests"
      title="Unit Verification (TP_SW555)"
      subtitle="Verifikation der Software-Einheiten. Actual Result, Tester und PASS/FAIL erst nach bestätigter Durchführung."
      icon={CheckCircle2}
      fields={swTestFields('verification')}
      orderBy="test_code"
      ascending
      extraFilter={(q) => q.eq('kind', 'verification')}
      defaults={{ kind: 'verification', result: 'offen' }}
    />
  );
}
