import { ClipboardList } from 'lucide-react';
import { PlmCrudPage } from '@/components/plm/PlmCrudPage';
import { swSurveyFields } from '@/lib/plm/software';

export default function SwSurveys() {
  return (
    <PlmCrudPage
      table="plm_sw_surveys"
      title="User Survey (Anwenderbefragung)"
      subtitle="Original-Feedback bleibt unverändert erhalten; Auswertung, Risikosignal und CAPA separat."
      icon={ClipboardList}
      fields={swSurveyFields}
      orderBy="survey_date"
    />
  );
}
