import BankDecisionList from '@/components/BankDecisionList';
import { CheckCircle2 } from 'lucide-react';

export default function ZusagenBank() {
  return (
    <BankDecisionList
      status="approved"
      title="Zusagen Bank"
      subtitle="Übersicht der bewilligten Leasing-Anfragen."
      icon={CheckCircle2}
      emptyText="Keine Zusagen vorhanden."
    />
  );
}
