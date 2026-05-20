import BankDecisionList from '@/components/BankDecisionList';
import { Clock } from 'lucide-react';

export default function AnfragenOffen() {
  return (
    <BankDecisionList
      status={['pending', 'in_review']}
      title="Anfragen offen"
      subtitle="Übersicht der laufenden, noch nicht entschiedenen Leasing-Anfragen."
      icon={Clock}
      emptyText="Keine offenen Anfragen vorhanden."
    />
  );
}
