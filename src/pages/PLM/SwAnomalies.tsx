import { AlertTriangle } from 'lucide-react';
import { PlmCrudPage } from '@/components/plm/PlmCrudPage';
import { swAnomalyFields } from '@/lib/plm/software';

export default function SwAnomalies() {
  return (
    <PlmCrudPage
      table="plm_sw_anomalies"
      title="Anomalienliste je Release"
      subtitle="Bekannte offene Fehler zum Freigabezeitpunkt inkl. Risikobewertung, Workaround und Akzeptanz."
      icon={AlertTriangle}
      fields={swAnomalyFields}
      orderBy="created_at"
      defaults={{ status: 'offen', severity: 'niedrig' }}
    />
  );
}
