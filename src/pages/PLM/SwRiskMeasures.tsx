import { ShieldCheck } from 'lucide-react';
import { PlmCrudPage } from '@/components/plm/PlmCrudPage';
import { swMeasureFields } from '@/lib/plm/software';

export default function SwRiskMeasures() {
  return (
    <PlmCrudPage
      table="plm_sw_risk_measures"
      title="Risikomaßnahmen & Wirksamkeitsnachweis"
      subtitle="Risiko → Maßnahme → Umsetzung → Verifikation der Wirksamkeit. Ergebnisse erst nach bestätigter Prüfung."
      icon={ShieldCheck}
      fields={swMeasureFields}
      orderBy="created_at"
      defaults={{ status: 'offen', measure_type: 'software_control' }}
    />
  );
}
